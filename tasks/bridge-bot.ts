/*
    npx hardhat bridge-bot --network avax
    pm2 start "npx hardhat bridge-bot --network avax" --name bridge-bot
*/

import {task} from "hardhat/config";

import * as ethers from "ethers";
import fetch from "cross-fetch";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {BigNumber} from "ethers";
import {delay} from "../utils/delay";

interface AttestationResponse {
    status: string;
    attestation?: string;
}

task("bridge-bot", "USDC Bridge bot")
    .setAction(async (args, hre) => {

        const wallet = ethers.Wallet.fromMnemonic(process.env.MNEMONIC);
        // @ts-ignore
        const signers: SignerWithAddress[] = await hre.ethers.getSigners();
        let signer = signers[1];
        console.log("Using signer: ", signer.address)

        const Splitter = require('../artifacts/contracts/Splitter.sol/Splitter.json');
        const USDC = require('../artifacts/contracts/mocks/USDC.sol/USDC.json');
        const TokenMessenger = require('../artifacts/contracts/interfaces/ITokenMessenger.sol/ITokenMessenger.json');
        const MessageTransmitter = require('../artifacts/contracts/interfaces/IMessageTransmitter.sol/IMessageTransmitter.json');

        const usdc = await hre.ethers.getContractAt(USDC.abi, '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', signer);
        const splitter = await hre.ethers.getContractAt(Splitter.abi, '0xA7Da9EA0F28A770EFb713c84a2da240C8162B4dc', signer);
        const tokenMessenger = await hre.ethers.getContractAt(TokenMessenger.abi, "0x6B25532e1060CE10cc3B0A99e5683b91BFDe6982", signer);
        const treasuryAddress = "0xCF23e5020497cE7129c02041FCceF9A0BA5e6554";

        while (true) {
            console.log(new Date().toISOString(), '- Initializing bridge bot...')

            const splitterBalance = await usdc.balanceOf(splitter.address)
            console.log(new Date().toISOString(), '- Splitter USDC balance:', ethers.utils.formatUnits(splitterBalance, 6))
            if (splitterBalance >= ethers.utils.parseUnits("1000", 6)) {
                console.log(new Date().toISOString(), '- USDC balance is not empty, triggering a bridge tx...')
                const tx = await splitter.releaseUsdcFunds();
                console.log('Splitter funds sent to Circle bridge');

                // Burn USDC
                // const destinationAddressInBytes32 = ethers.utils.defaultAbiCoder.encode(
                //     ["address"],
                //     [treasuryAddress]
                // );
                // const burnUSDC = await tokenMessenger.depositForBurn(
                //     amount,
                //     3, // destinationChainId (3 for Arbitrum)
                //     destinationAddressInBytes32,
                //     usdc.address,
                // );
                console.log(`Depositing USDC to Token Messenger contract on Avax...`);
                console.log("Deposited - txHash:", tx.hash);
                await tx.wait(1);

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
                console.log("Message Bytes:", messageBytes);
                console.log("Message Hash:", messageHash);

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
                const maxFeePerGas = ethers.utils.hexlify(150000000);
                const gasPrice = ethers.utils.parseUnits('0.1', 'gwei'); // 0.1 Gwei gas price on Arbitrum
                const receiveTx = await arbitrumMessageTransmitter.receiveMessage(messageBytes, attestationSignature, {
                    maxPriorityFeePerGas: gasPrice,
                    maxFeePerGas: maxFeePerGas,
                });

                await receiveTx.wait(1);
                console.log("Received funds successfully - txHash:", receiveTx.hash);
            }

            await delay(60 * 60 * 1000);// 1 hour in milliseconds
        }

    });