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
const treasuryAddress = "0xa302dd52a4a85e6778E6A64A0E5EB0e8C76463d6";
const cUSDAddress = "0x765de816845861e75a25fca122bb6898b8b1282a";
const uniswapNFTPositionManagerId = 3108;
const PACTAddress = "0x46c9757C5497c5B1f2eb73aE79b6B67D119B0B58";


// //alfajores
// const governanceDelegatorAddress = "0x5c27e2600a3eDEF53DE0Ec32F01efCF145419eDF";
// const treasuryAddress = "0xB0deEE097B5227C5E6bbE787665e4e62b4fE85f3";
// const cUSDAddress = "0x874069fa1eb16d44d622f2e0ca25eea172369bc1";


let GovernanceProxy: ethersTypes.Contract;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	// const { deployments, ethers } = hre;

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
			treasuryAddress,
		],
		[0],
		[
			"setToken(address,uint256,uint8,uint256,uint256,uint256,bytes,bytes)"
		],
		[
			["address", "uint256", "uint8", "uint256", "uint256", "uint256", "bytes", "bytes"]
		],
		[
			[cUSDAddress, toEther(1), 1, toEther(50), toEther(300), uniswapNFTPositionManagerId, "0x", getExchangePathProd(cUSDAddress, PACTAddress)]
		],
		'Add treasury tokens'
	);
}

export default func;
func.tags = ["Treasury_setToken"];
