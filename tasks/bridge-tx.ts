/*
    npx hardhat bridge-bot --network avax
*/

import {task} from "hardhat/config";

import * as ethers from "ethers";
import fetch from "cross-fetch";
import {BigNumber, Contract} from "ethers";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";

import Web3 from "web3";

interface AttestationResponse {
    status: string;
    attestation?: string;
}

task("bridge-tx", "USDC Bridge bot")
    .setAction(async (args, hre) => {
        console.log(new Date().toISOString(), '- Initializing bridge bot...')

        const wallet = ethers.Wallet.fromMnemonic(process.env.MNEMONIC);
        // @ts-ignore
        const signers: SignerWithAddress[] = await hre.ethers.getSigners();
        let signer = signers[0];
        // const Splitter = await hre.artifacts.readArtifact("Splitter");
        // const USDC = await hre.artifacts.readArtifact("USDC");
        const Splitter = require('../artifacts/contracts/Splitter.sol/Splitter.json');
        const USDC = require('../artifacts/contracts/mocks/USDC.sol/USDC.json');
        const TokenMessenger = require('../artifacts/contracts/interfaces/ITokenMessenger.sol/ITokenMessenger.json');
        const MessageTransmitter = require('../artifacts/contracts/interfaces/IMessageTransmitter.sol/IMessageTransmitter.json');

        console.log(new Date().toISOString(), '- Fetching USDC balance...')
        // @ts-ignore
        const usdc = await hre.ethers.getContractAt(USDC.abi, '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', signer);
        // @ts-ignore
        console.log(new Date().toISOString(), '- Fetching Splitter contract...')
        const splitter = await hre.ethers.getContractAt(Splitter.abi, '0xA7Da9EA0F28A770EFb713c84a2da240C8162B4dc', signer);

        const txHash = '0xc610ff08b7a228e309f937982664d4b769a63c4ce9e732b8ae64ad001c229a6b';

        const receipt = await hre.ethers.provider.getTransactionReceipt(txHash);
        // console.log("Receipt:", receipt);
        // console.log("Logs:", receipt.logs);

        // Retrieve message bytes from logs
        const eventTopic = ethers.utils.keccak256(
            ethers.utils.toUtf8Bytes("MessageSent(bytes)")
        );

        const log = receipt.logs.find(
            (l) => l.topics[0] === eventTopic
        );
        console.log("Log:", log);
        const messageBytes = ethers.utils.defaultAbiCoder.decode(
            ["bytes"],
            log.data
        )[0];
        console.log("Log data", log.data);
        console.log("Message Bytes:", messageBytes);

        const messageHash = ethers.utils.keccak256(messageBytes);
        console.log("Message Hash:", messageHash);

        const web3 = new Web3('https://api.avax.network/ext/bc/C/rpc');
        const transactionReceipt2 = await web3.eth.getTransactionReceipt(txHash);
        const eventTopic2 = web3.utils.keccak256('MessageSent(bytes)')
        const log2 = transactionReceipt2.logs.find((l) => l.topics[0] === eventTopic2)
        const messageBytes2 = web3.eth.abi.decodeParameters(['bytes'], log2.data)[0];
        console.log("Message Hash 2:", web3.utils.keccak256(messageBytes2));

        // Fetch attestation signature
        console.log("Fetching attestation signature...");
        let attestationResponse: AttestationResponse = {status: "pending"};
        while (attestationResponse.status !== "complete") {
            const response = await fetch(
                `https://iris-api.circle.com/attestations/${messageHash}`
            );
            attestationResponse = await response.json();
            console.log(attestationResponse);
            console.log("Attestation Status:", attestationResponse.status || "sent");
            await new Promise((r) => setTimeout(r, 2000));
        }

        const attestationSignature = attestationResponse.attestation;
        console.log(`Obtained Signature: ${attestationSignature}`);

        const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
        const signer2 = wallet.connect(provider);
        const arbitrumMessageTransmitter = await hre.ethers.getContractAt(MessageTransmitter.abi, '0xC30362313FBBA5cf9163F0bb16a0e01f01A896ca', signer2);

        // Using the message bytes and signature receive the funds on destination chain and address
        console.log(`Receiving funds on Arbitrum...`);
        const gasLimit = ethers.utils.hexlify(15000000); // 15,000,000 gas limit
        const gasPrice = ethers.utils.parseUnits('0.1', 'gwei'); // 0.1 Gwei gas price on Arbitrum
        const receiveTx = await arbitrumMessageTransmitter.receiveMessage(messageBytes, attestationSignature, {
            gasLimit: gasLimit,
            gasPrice: gasPrice
        });

        await receiveTx.wait(1);
        console.log("Received funds successfully - txHash:", receiveTx.hash);

    });