import * as ethersTypes from "ethers";
import { parseEther } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployments, ethers } from "hardhat";
import { toEther } from "../utils/helpers";

const oneMinuteInBlocks = 12;
const threeMinutesInBlocks = 36;
const claimAmountTwo = parseEther("2");
const maxClaimTen = parseEther("10");
const oneCent = parseEther("0.01");
const communityMinTranche = parseEther("100");
const communityMaxTranche = parseEther("5000");
const maxBeneficiaries = 100;

export async function createDefaultCommunityAdmin(
	ambassadorsEntity: SignerWithAddress,
	ambassador: SignerWithAddress
): Promise<ethersTypes.Contract> {
	const cUSD = await ethers.getContractAt(
		"TokenMock",
		(
			await deployments.get("TokenMock")
		).address
	);

	const CommunityAdmin = await ethers.getContractAt(
		"CommunityAdminImplementation",
		(
			await deployments.get("CommunityAdminProxy")
		).address
	);

	const AmbassadorsProxy = await ethers.getContractAt(
		"AmbassadorsImplementation",
		(
			await deployments.get("AmbassadorsProxy")
		).address
	);

	await AmbassadorsProxy.addEntity(ambassadorsEntity.address);
	await AmbassadorsProxy.connect(ambassadorsEntity).addAmbassador(
		ambassador.address
	);

	await cUSD.transfer(
		(
			await deployments.get("TreasuryProxy")
		).address,
		toEther(1000)
	);

	return CommunityAdmin;
}

export async function createDefaultCommunity(
	communityAdminProxy: ethersTypes.Contract,
	communityManager: SignerWithAddress,
	ambassador: SignerWithAddress
): Promise<ethersTypes.Contract> {
	const cUSD = await ethers.getContractAt(
		"TokenMock",
		(
			await deployments.get("TokenMock")
		).address
	);

	const tx = await communityAdminProxy.addCommunity(
		cUSD.address,
		[communityManager.address],
		ambassador.address,
		claimAmountTwo,
		maxClaimTen,
		oneCent,
		threeMinutesInBlocks,
		oneMinuteInBlocks,
		communityMinTranche,
		communityMaxTranche,
		maxBeneficiaries
	);

	let receipt = await tx.wait();

	const communityAddress = receipt.events?.filter((x: any) => {
		return x.event == "CommunityAdded";
	})[0]["args"]["communityAddress"];

	return ethers.getContractAt("CommunityImplementation", communityAddress);
}
