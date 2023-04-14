import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { createProposal, toEther } from "../../../test/utils/helpers";
import * as ethersTypes from "ethers";
import {generateMerkleTreeFromFile} from "../../../script/merkleTree/generateMerkleTree";

let deployer: SignerWithAddress;

// // mainnet
const governanceDelegatorAddress = "0x8f8BB984e652Cb8D0aa7C9D6712Ec2020EB1BAb4";
const airdropV1Address = "0xd2b20e06C19e7b7E7E385b0F1386Cdde8C6dCd2B";
const PACTAddress = "0x46c9757C5497c5B1f2eb73aE79b6B67D119B0B58";
const impactLabsMultisig = "0x266f8E061AD13dDF79Cb662FF633Ddb6dd40725d";


let GovernanceProxy: ethersTypes.Contract;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const accounts: SignerWithAddress[] = await ethers.getSigners();
	deployer = accounts[0];

	GovernanceProxy = await ethers.getContractAt(
		"PACTDelegate",
		governanceDelegatorAddress
	);

	await createCallProposal();
};

async function createCallProposal() {
	console.log("Creating new proposal");

	await createProposal(
		GovernanceProxy,
		deployer,
		[
			airdropV1Address
		],
		[0],
		[
			"transfer(address,address,uint256)"
		],
		[
			["address", "address", 'uint256']
		],
		[
			[PACTAddress, impactLabsMultisig, '236261242500674278651199488'],
		],
		'Transfer all PACTs from AirdropV1'
	);
}

export default func;
func.tags = ["AirdropV1_transferERC20"];
