import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";

const { deploy } = deployments;
let deployer: SignerWithAddress;

// mainnet
// const timelockAddress = "0xca3171A5FCda4D840Aa375E907b7A1162aDA9379";
const ownerAddress = "0xa34737409091eBD0726A3Ab5863Fc7Ee9243Edab";
const proxyAdminAddress = "0xFC641CE792c242EACcD545B7bee2028f187f61EC";
const socialConnectAddress = "0x0aD5b1d0C25ecF6266Dd951403723B2687d6aff2";
const socialConnectIssuerAddress = "0x388612590F8cC6577F19c9b61811475Aa432CB44";
const signerWalletAddress = "0xC677bE84FFAaA4Eb323EE790B283AA63d3aDeCb4";

// // alfajores
// // const timelockAddress = "0xcb0C15AdE117C812E4d96165472EbF83Bed231B0";
// const ownerAddress = "0xa34737409091eBD0726A3Ab5863Fc7Ee9243Edab";
// const proxyAdminAddress = "0x79f9ca5f1A01e1768b9C24AD37FF63A0199E3Fe5";
// const socialConnectAddress = "0x70F9314aF173c246669cFb0EEe79F9Cfd9C34ee3";
// const socialConnectIssuerAddress = "0xe3475047EF9F9231CD6fAe02B3cBc5148E8eB2c8";
// const signerWalletAddress = "0xC677bE84FFAaA4Eb323EE790B283AA63d3aDeCb4";


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const accounts: SignerWithAddress[] = await ethers.getSigners();
	deployer = accounts[0];

	await deployReferralLink();
};

async function deployReferralLink() {
	console.log("Deploying ReferralLink contracts");

	const ReferralLinkImplementationResult = await deploy("ReferralLinkImplementation", {
		from: deployer.address,
		args: [],
		log: true,
		// gasLimit: 13000000,
	});

	await new Promise((resolve) => setTimeout(resolve, 6000));
	const ReferralLinkProxyResult = await deploy("ReferralLinkProxy", {
		from: deployer.address,
		args: [ReferralLinkImplementationResult.address, proxyAdminAddress],
		log: true,
		// gasLimit: 13000000,
	});

	const ReferralLinkContract = await ethers.getContractAt(
		"ReferralLinkImplementation",
		ReferralLinkProxyResult.address
	);

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await ReferralLinkContract.initialize(
		signerWalletAddress,
		socialConnectAddress,
		socialConnectIssuerAddress
	);

	await new Promise((resolve) => setTimeout(resolve, 6000));
	await ReferralLinkContract.transferOwnership(ownerAddress);
}

export default func;
func.tags = ["ReferralLink"];
