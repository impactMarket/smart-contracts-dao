import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";

const { deploy } = deployments;
let deployer: SignerWithAddress;

// // mainnet
// const timelockAddress = "0xca3171A5FCda4D840Aa375E907b7A1162aDA9379";
// const proxyAdminAddress = "0xFC641CE792c242EACcD545B7bee2028f187f61EC";
// const treasuryAddress = "";
// const uniswapRouterAddress = "0x5615CDAb10dc425a742d643d949a7F474C01abc4";
// const uniswapQuoterAddress = "0x82825d0554fA07f7FC52Ab63c961F330fdEFa8E8";
// const uniswapNFTPositionManagerAddress = "0x3d79EdAaBC0EaB6F08ED885C05Fc0B014290D95A";

// alfajores
const timelockAddress = "0xcb0C15AdE117C812E4d96165472EbF83Bed231B0";
const proxyAdminAddress = "0x79f9ca5f1A01e1768b9C24AD37FF63A0199E3Fe5";
const treasuryAddress = "0xB0deEE097B5227C5E6bbE787665e4e62b4fE85f3";
const uniswapRouterAddress = "0x5615CDAb10dc425a742d643d949a7F474C01abc4";
const uniswapQuoterAddress = "0x82825d0554fA07f7FC52Ab63c961F330fdEFa8E8";
const uniswapNFTPositionManagerAddress = "0x3d79EdAaBC0EaB6F08ED885C05Fc0B014290D95A";


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const accounts: SignerWithAddress[] = await ethers.getSigners();
	deployer = accounts[0];

	await deployTreasuryLpSwap();
};

async function deployTreasuryLpSwap() {
	console.log("Deploying TreasuryLpSwap contracts");

	const TreasuryLpSwapImplementationResult = await deploy("TreasuryLpSwapImplementation", {
		from: deployer.address,
		args: [],
		log: true,
		// gasLimit: 13000000,
	});

	await new Promise((resolve) => setTimeout(resolve, 6000));
	const TreasuryLpSwapProxyResult = await deploy("TreasuryLpSwapProxy", {
		from: deployer.address,
		args: [TreasuryLpSwapImplementationResult.address, proxyAdminAddress],
		log: true,
		// gasLimit: 13000000,
	});

	const TreasuryLpSwapContract = await ethers.getContractAt(
		"TreasuryLpSwapImplementation",
		TreasuryLpSwapProxyResult.address
	);

	await new Promise((resolve) => setTimeout(resolve, 6000));

	await TreasuryLpSwapContract.initialize(
		treasuryAddress,
		uniswapRouterAddress,
		uniswapQuoterAddress,
		uniswapNFTPositionManagerAddress
	);

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await TreasuryLpSwapContract.transferOwnership(timelockAddress);
}

export default func;
func.tags = ["TreasuryLpSwap"];
