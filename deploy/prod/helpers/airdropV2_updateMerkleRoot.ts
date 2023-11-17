import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import { createProposal, toEther } from "../../../test/utils/helpers";
import * as ethersTypes from "ethers";
import {generateMerkleTreeFromFile} from "../../../script/merkleTree/generateMerkleTree";

const { deploy } = deployments;
let deployer: SignerWithAddress;

// // mainnet
// const governanceDelegatorAddress = "0x8f8BB984e652Cb8D0aa7C9D6712Ec2020EB1BAb4";
// const airdropV2Address = "";


//alfajores
const governanceDelegatorAddress = "0x5c27e2600a3eDEF53DE0Ec32F01efCF145419eDF";
const airdropV2Address = "0xEb0b7fE19c764224e4a6572CC0EA80074489896E";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const accounts: SignerWithAddress[] = await ethers.getSigners();
	deployer = accounts[0];

	await createCallProposal();
};

async function createCallProposal() {
	console.log("Creating new proposal");

	await createProposal(
		governanceDelegatorAddress,
		deployer,
		[
			airdropV2Address
		],
		[0],
		[
			"updateMerkleRoot(bytes32)"
		],
		[
			["bytes32"]
		],
		[
			[generateMerkleTreeFromFile()],
		],
		'Updates AirdropV2 merkle root'
	);
}

export default func;
func.tags = ["AirdropV2_updateMerkleRoot"];
