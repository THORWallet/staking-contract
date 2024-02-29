// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.19;

interface ITokenMessenger {
    event DepositForBurn(
        uint64 indexed nonce,
        address indexed burnToken,
        uint256 amount,
        address indexed depositor,
        bytes32 mintRecipient,
        uint32 destinationDomain,
        bytes32 destinationTokenMessenger,
        bytes32 destinationCaller
    );

    event MintAndWithdraw(
        address indexed mintRecipient,
        uint256 amount,
        address indexed mintToken
    );

    event RemoteTokenMessengerAdded(uint32 domain, bytes32 tokenMessenger);
    event RemoteTokenMessengerRemoved(uint32 domain, bytes32 tokenMessenger);
    event LocalMinterAdded(address localMinter);
    event LocalMinterRemoved(address localMinter);

    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken
    ) external returns (uint64 _nonce);

    function depositForBurnWithCaller(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller
    ) external returns (uint64 nonce);

    function replaceDepositForBurn(
        bytes calldata originalMessage,
        bytes calldata originalAttestation,
        bytes32 newDestinationCaller,
        bytes32 newMintRecipient
    ) external;

    function handleReceiveMessage(
        uint32 remoteDomain,
        bytes32 sender,
        bytes calldata messageBody
    ) external returns (bool);

    function addRemoteTokenMessenger(uint32 domain, bytes32 tokenMessenger) external;
    function removeRemoteTokenMessenger(uint32 domain) external;
    function addLocalMinter(address newLocalMinter) external;
    function removeLocalMinter() external;
}