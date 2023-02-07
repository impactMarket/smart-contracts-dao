import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

// //mainnet
const LENDING_POOL_ADDRESS = "0x970b12522CA9b4054807a2c5B736149a5BE6f670";
const proxyAdminAddress = "0xFC641CE792c242EACcD545B7bee2028f187f61EC";
const treasuryAddress = "0xa302dd52a4a85e6778E6A64A0E5EB0e8C76463d6";
const donationMinerAddress = "0x1C51657af2ceBA3D5492bA0c5A17E562F7ba6593";
const timelockAddress = "0xca3171A5FCda4D840Aa375E907b7A1162aDA9379";
const cUSDAddress = "0x765DE816845861e75A25fCA122bb6898B8B1282a";


// alfajores
// const LENDING_POOL_ADDRESS = "0x58ad305f1eCe49ca55ADE0D5cCC90114C3902E88";
// const proxyAdminAddress = "0x79f9ca5f1A01e1768b9C24AD37FF63A0199E3Fe5";
// const treasuryAddress = "0xB0deEE097B5227C5E6bbE787665e4e62b4fE85f3";
// const donationMinerAddress = "0x09Cdc8f50994F63103bc165B139631A6ad18EF49";
// const cUSDAddress = "0x874069fa1eb16d44d622f2e0ca25eea172369bc1";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	// @ts-ignore
	const { deployments, ethers } = hre;
	const { deploy } = deployments;

	const accounts: SignerWithAddress[] = await ethers.getSigners();
	const deployer = accounts[0];

	const ownerAddress = timelockAddress;

	const depositImplementationResult = await deploy("DepositImplementation", {
		from: deployer.address,
		args: [],
		log: true,
		// gasLimit: 13000000,
	});

	const depositProxyResult = await deploy("DepositProxy", {
		from: deployer.address,
		args: [depositImplementationResult.address, proxyAdminAddress],
		log: true,
		// gasLimit: 13000000,
	});

	const depositContract = await ethers.getContractAt(
		"DepositImplementation",
		depositProxyResult.address
	);

	await depositContract.initialize(
		treasuryAddress,
		donationMinerAddress,
		LENDING_POOL_ADDRESS,
		[cUSDAddress]
	);

	await depositContract.transferOwnership(ownerAddress);
};

export default func;
func.tags = ["DepositProd"];
