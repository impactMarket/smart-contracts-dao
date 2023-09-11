import {ethers, upgrades} from "hardhat";

//alfajores
const impactMultiSigProxyAdminAddress = "0x109106C3C20be1320a2677AC14D62E4309f39280";
const cUSDAddress = "0x874069fa1eb16d44d622f2e0ca25eea172369bc1";
const ownerAddress = "0xa34737409091eBD0726A3Ab5863Fc7Ee9243Edab";

// // mainnet
// const impactMultiSigProxyAdminAddress = "0x5e7912f6C052D4D7ec8D6a14330c0c3a538e3f2B";
// const cUSDAddress = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
// const ownerAddress = "0xa34737409091eBD0726A3Ab5863Fc7Ee9243Edab";



async function main() {
	// const microcredit = await upgrades.deployProxy(
	// 	await ethers.getContractFactory("MicrocreditImplementation"),
	// 	[cUSDAddress, ownerAddress],
	// 	{verifySourceCode: true}
	// );
	// await microcredit.deployed();
	// console.log("microcredit deployed to:", await microcredit.address);



	const microcreditV2 = await upgrades.upgradeProxy(
		'0x323a1E64A978AbCe3e29Ba0419dB3541aa7023dd',
		await ethers.getContractFactory("MicrocreditImplementation"));
	console.log("Microcredit upgraded");
}

main();
