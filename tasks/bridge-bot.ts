/*
    npx hardhat bridge-bot --network avax
*/

import {task} from "hardhat/config";

import * as ethers from "ethers";
import fetch from "cross-fetch";
import {Contract} from "ethers";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";

interface AttestationResponse {
    status: string;
    attestation?: string;
}

task("bridge-bot", "USDC Bridge bot")
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

        console.log(new Date().toISOString(), '- Fetching USDC balance...')
        // @ts-ignore
        const usdc = await hre.ethers.getContractAt(USDC.abi, '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', signer);
        // @ts-ignore
        console.log(new Date().toISOString(), '- Fetching Splitter contract...')
        const splitter = await hre.ethers.getContractAt(Splitter.abi, '0x724C13E376Aa9b506fA5263463f3c780B36Bd79C', signer);

        const splitterBalance = await usdc.balanceOf(splitter.address)
        console.log(new Date().toISOString(), '- Splitter USDC balance:', ethers.utils.formatUnits(splitterBalance, 6))
        if (splitterBalance > 0) {
            console.log(new Date().toISOString(), '- USDC balance is not empty, triggering a bridge tx...')
            const tx = await splitter.releaseUsdcFunds();
            console.log('Splitter funds sent to Circle bridge');

            // await tx.wait(3);
            console.log('Tx data', tx)
            console.log("Deposited - txHash:", tx.hash);
            const receipt = await hre.ethers.provider.getTransactionReceipt(tx.hash);
            console.log("Receipt:", receipt);
            console.log("Logs:", receipt.logs);

            // Retrieve message bytes from logs
            const eventTopic = ethers.utils.keccak256(
                ethers.utils.toUtf8Bytes("MessageSent(bytes)")
            );

            const log = receipt.logs.find(
                (l) => l.topics[0] === eventTopic
            );
            const messageBytes = ethers.utils.defaultAbiCoder.decode(
                ["bytes"],
                log.data
            )[0];
            const messageHash = ethers.utils.keccak256(messageBytes);
            console.log("Message Hash:", messageHash);

            // Fetch attestation signature
            console.log("Fetching attestation signature...");
            let attestationResponse: AttestationResponse = {status: "pending"};
            while (attestationResponse.status !== "complete") {
                const response = await fetch(
                    `https://iris-api-sandbox.circle.com/attestations/${messageHash}`
                );
                attestationResponse = await response.json();
                console.log(attestationResponse);
                console.log("Attestation Status:", attestationResponse.status || "sent");
                await new Promise((r) => setTimeout(r, 2000));
            }

            const attestationSignature = attestationResponse.attestation;
            console.log(`Obtained Signature: ${attestationSignature}`);

            const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
            const signer = wallet.connect(provider);
            const arbitrumMessageTransmitter = await hre.ethers.getContractAt(TokenMessenger.abi, '0xC30362313FBBA5cf9163F0bb16a0e01f01A896ca', signer);

            // Using the message bytes and signature receive the funds on destination chain and address
            console.log(`Receiving funds on Arbitrum...`);
            const receiveTx = await arbitrumMessageTransmitter.call(
                "receiveMessage",
                [messageBytes, attestationSignature]
            );
            // await receiveTx.wait(3);
            console.log(
                "Received funds successfully - txHash:",
                receiveTx.hash
            );
        }

    });