// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract CertificateVerification {

    mapping(bytes32 => bool) public certificates;

    event CertificateStored(bytes32 hash);

    function storeCertificate(bytes32 hash) public {

        require(!certificates[hash], "Certificate already stored");

        certificates[hash] = true;

        emit CertificateStored(hash);
    }

    function verifyCertificate(bytes32 hash)
        public
        view
        returns(bool)
    {
        return certificates[hash];
    }
}