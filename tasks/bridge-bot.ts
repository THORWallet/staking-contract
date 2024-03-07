/*
    npx hardhat bridge-bot --network avax
*/

import {task} from "hardhat/config";

import * as ethers from "ethers";
import fetch from "cross-fetch";
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
        // const Splitter = require('../artifacts/contracts/Splitter.sol/Splitter.json');
        const USDC = require('../artifacts/contracts/mocks/USDC.sol/USDC.json');
        const TokenMessenger = require('../artifacts/contracts/interfaces/ITokenMessenger.sol/ITokenMessenger.json');
        const MessageTransmitter = require('../artifacts/contracts/interfaces/IMessageTransmitter.sol/IMessageTransmitter.json');

        // const usdc = await hre.ethers.getContractAt(USDC.abi, '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', signer);
        const usdc = await hre.ethers.getContractAt(USDC.abi, '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', signer);
        // const splitter = await hre.ethers.getContractAt(Splitter.abi, '0x724C13E376Aa9b506fA5263463f3c780B36Bd79C', signer);
        // const tokenMessenger = await hre.ethers.getContractAt(TokenMessenger.abi, "0x6B25532e1060CE10cc3B0A99e5683b91BFDe6982", signer);
        const tokenMessenger = await hre.ethers.getContractAt(TokenMessenger.abi, "0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5", signer);
        const treasuryAddress = "0xCF23e5020497cE7129c02041FCceF9A0BA5e6554";
        // const splitterBalance = await usdc.balanceOf(splitter.address)
        const signerBalance = await usdc.balanceOf(signer.address)
        console.log(new Date().toISOString(), '- Splitter USDC balance:', ethers.utils.formatUnits(signerBalance, 6))
        if (signerBalance > 0) {
            console.log(new Date().toISOString(), '- USDC balance is not empty, triggering a bridge tx...')
            // const tx = await splitter.releaseUsdcFunds();
            // console.log('Splitter funds sent to Circle bridge');

            // Amount that will be transferred
            const amount = ethers.utils.parseUnits("0.01", 6);

            // Approve messenger contract to withdraw from our active eth address
            console.log(`Approving USDC transfer on Avax}...`);

            const approveMessengerWithdraw = await usdc.approve(tokenMessenger.address, amount);

            console.log(
                "Approved - txHash:",
                approveMessengerWithdraw.hash
            );

            await approveMessengerWithdraw.wait(1);

            // Burn USDC
            console.log(`Depositing USDC to Token Messenger contract on Avax...`);
            const destinationAddressInBytes32 = ethers.utils.defaultAbiCoder.encode(
                ["address"],
                [treasuryAddress]
            );
            const burnUSDC = await tokenMessenger.depositForBurn(
                amount,
                3, // destinationChainId (3 for Arbitrum)
                destinationAddressInBytes32,
                usdc.address,
            );
            console.log("Deposited - txHash:", burnUSDC.hash);
            await burnUSDC.wait(1);

            const receipt = await hre.ethers.provider.getTransactionReceipt(burnUSDC.hash);
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

            // const provider = new ethers.providers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
            const provider = new ethers.providers.JsonRpcProvider("https://sepolia-rollup.arbitrum.io/rpc");
            const signer2 = wallet.connect(provider);
            // const arbitrumMessageTransmitter = await hre.ethers.getContractAt(TokenMessenger.abi, '0xC30362313FBBA5cf9163F0bb16a0e01f01A896ca', signer2);
            const arbitrumMessageTransmitter = await hre.ethers.getContractAt(MessageTransmitter.abi, '0xaCF1ceeF35caAc005e15888dDb8A3515C41B4872', signer2);

            // Using the message bytes and signature receive the funds on destination chain and address
            console.log(`Receiving funds on Arbitrum...`);
            const receiveTx = await arbitrumMessageTransmitter.receiveMessage(
                messageBytes, attestationSignature
            );
            await receiveTx.wait(1);
            console.log(
                "Received funds successfully - txHash:",
                receiveTx.hash
            );
        }

    });