import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { toEther } from "../../../test/utils/helpers";
import {generateMerkleTree, generateMerkleTreeFromFile} from "../../../script/merkleTree/generateMerkleTree";


//alfajores
const governanceDelegatorAddress = "0x5c27e2600a3eDEF53DE0Ec32F01efCF145419eDF";
const proxyAdminAddress = "0x79f9ca5f1A01e1768b9C24AD37FF63A0199E3Fe5";
const communityAdminProxyAddress = "0x1c33D75bcE52132c7a0e220c1C338B9db7cf3f3A";
const PACTAddress = "0x73A2De6A8370108D43c3C80430C84c30df323eD2";


// // mainnet
// const governanceDelegatorAddress = "0x8f8BB984e652Cb8D0aa7C9D6712Ec2020EB1BAb4";
// const proxyAdminAddress = "0xFC641CE792c242EACcD545B7bee2028f187f61EC";
// const communityAdminProxyAddress = "0xd61c407c3A00dFD8C355973f7a14c55ebaFDf6F9";
// const PACTAddress = "";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, ethers } = hre;
	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];

	// // const ownerAddress = (await deployments.get("PACTTimelock")).address; //prod
	// // const ownerAddress = deployer.address; //dev
	// const ownerAddress = "0x7110b4Df915cb92F53Bc01cC9Ab15F51e5DBb52F"; //testing
	//
	// const PACT = await deployments.get("PACTToken");
	//
	// console.log('1');
	//
	// const airdropV2ImplementationResult = await deploy(
	// 	"AirdropV2Implementation",
	// 	{
	// 		from: deployer.address,
	// 		args: [],
	// 		log: true,
	// 		// gasLimit: 13000000,
	// 	}
	// );
	//
	// console.log('2');
	//
	//
	// await new Promise((resolve) => setTimeout(resolve, 6000));
	//
	//
	// const airdropV2ProxyResult = await deploy("AirdropV2Proxy", {
	// 	from: deployer.address,
	// 	args: [airdropV2ImplementationResult.address, proxyAdminAddress],
	// 	log: true,
	// 	// gasLimit: 13000000,
	// });
	//
	// console.log('3');
	//
	//
	// await new Promise((resolve) => setTimeout(resolve, 6000));
	//
	// const airdropV2Contract = await ethers.getContractAt(
	// 	"AirdropV2Implementation",
	// 	airdropV2ProxyResult.address
	// );
	//
	// const startTime = 0;
	// const trancheAmount = toEther(100);
	// const totalAmount = toEther(1000);
	// const cooldown = 1800;
	//
	// await airdropV2Contract.initialize(
	// 	PACT.address,
	// 	startTime,
	// 	trancheAmount,
	// 	totalAmount,
	// 	cooldown,
	// 	generateMerkleTreeFromFile()
	// );
	//
	// console.log('4');
	//
	// await new Promise((resolve) => setTimeout(resolve, 6000));
	//
	// await airdropV2Contract.transferOwnership(ownerAddress);
	//
	// console.log('5');
	//
	//
	// await new Promise((resolve) => setTimeout(resolve, 6000));

	const PACTContract = await ethers.getContractAt(
		"PACTToken",
		PACTAddress
	);

	await PACTContract.transfer('0x1f000c5ea419Be6E1e548E30e727F290Fc947d76', toEther(100000));

	console.log('6');
};

export default func;
func.tags = ["AirdropV2Prod"];
