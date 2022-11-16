import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { toEther } from "../../../test/utils/helpers";
import {generateMerkleTree, generateMerkleTreeFromFile} from "../../../script/merkleTree/generateMerkleTree";


//alfajores
const proxyAdminAddress = "0x79f9ca5f1A01e1768b9C24AD37FF63A0199E3Fe5";
const timelockAddress = "0xcb0C15AdE117C812E4d96165472EbF83Bed231B0";


// // mainnet
// const proxyAdminAddress = "0xFC641CE792c242EACcD545B7bee2028f187f61EC";
// const timelockAddress = "0xca3171A5FCda4D840Aa375E907b7A1162aDA9379";


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, ethers } = hre;
	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];

	const PACT = await deployments.get("PACTToken");

	console.log('1');

	const airdropV2ImplementationResult = await deploy(
		"AirdropV2Implementation",
		{
			from: deployer.address,
			args: [],
			log: true,
			// gasLimit: 13000000,
		}
	);

	console.log('2');


	await new Promise((resolve) => setTimeout(resolve, 6000));


	const airdropV2ProxyResult = await deploy("AirdropV2Proxy", {
		from: deployer.address,
		args: [airdropV2ImplementationResult.address, proxyAdminAddress],
		log: true,
		// gasLimit: 13000000,
	});

	console.log('3');


	await new Promise((resolve) => setTimeout(resolve, 6000));

	const airdropV2Contract = await ethers.getContractAt(
		"AirdropV2Implementation",
		airdropV2ProxyResult.address
	);

	const startTime = 0;
	const trancheAmount = toEther(50);
	const totalAmount = toEther(1000);
	const cooldown = 60*60*24*7;

	await airdropV2Contract.initialize(
		PACT.address,
		startTime,
		trancheAmount,
		totalAmount,
		cooldown,
		'0x37aec8e9dbddd1c2130039f9fae43884374811e13485e5818d2db69a5affdddb'
	);

	console.log('4');

	// await new Promise((resolve) => setTimeout(resolve, 6000));
	//
	// await airdropV2Contract.transferOwnership(timelockAddress);
	//
	// console.log('5');
};

export default func;
func.tags = ["AirdropV2Prod"];
