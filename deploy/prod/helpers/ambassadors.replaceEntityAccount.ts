import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import { createProposal, toEther } from "../../../test/utils/helpers";
import * as ethersTypes from "ethers";
import {getExchangePathProd} from "../../../test/utils/uniswap";

const { deploy } = deployments;
let deployer: SignerWithAddress;

// mainnet
const governanceDelegatorAddress = "0x8f8BB984e652Cb8D0aa7C9D6712Ec2020EB1BAb4";
const ambassadorsAddress = "0x25f58d8C2522dC7E0C53cF8163C837De2415Ba51";
const newOldAddress = "0x266f8E061AD13dDF79Cb662FF633Ddb6dd40725d";
const newEntityAddress = "0xd3762200407133f7dDd5FE6073300fea3CaC948a";

// // //alfajores
// const governanceDelegatorAddress = "0x5c27e2600a3eDEF53DE0Ec32F01efCF145419eDF";
// const ambassadorsAddress = "0xF7f1675e5A6fa5D2dd4F3b534a59B5B6Ef866221";
// const newEntityAddress = "0x1FfceAF524aB1a882a1FD5E17ba650F33A969094";

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
			ambassadorsAddress,
		],
		[0],
		[
			"replaceEntityAccount(address,address)"
		],
		[
			["address","address"]
		],
		[
			[newOldAddress, newEntityAddress]
		],
		'Ambassadors - replaceEntityAccount'
	);
}

export default func;
func.tags = ["Ambassadors_replaceEntityAccount"];
