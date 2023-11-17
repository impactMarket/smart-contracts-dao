// @ts-ignore
import {ethers, config, network} from "hardhat";
const fs = require('fs');

// mainnet
const communityAdminAddress = "0xd61c407c3A00dFD8C355973f7a14c55ebaFDf6F9";

// // alfajores
// const communityAdminAddress = "0x1c33D75bcE52132c7a0e220c1C338B9db7cf3f3A";

let communityAdmin: any;

type Community = {
    address: string;
    beneficiariesNumber: number;
    validBeneficiariesNumber: number;
}


let communities: {[key: number]: Community} = {};

// let communities: {key: numberCommunity[] = [];
let beneficiaries: any[] = [];

let communityListLength: number;
let maxBeneficiariesNumber = 0
let totalBeneficiariesNumber = 0
let totalValidBeneficiariesNumber = 0

async function parseCommunity(index: number): Promise<void> {
    const communityAddress = await communityAdmin.communityListAt(index);
    let community = await ethers.getContractAt(
        "CommunityImplementation",
        communityAddress
    );

    let validBeneficiaryCount = (await community.validBeneficiaryCount()).toNumber();
    let beneficiaryCount = (await community.beneficiaryListLength()).toNumber();

    communities[index] = {
        address: communityAddress,
        beneficiariesNumber: beneficiaryCount,
        validBeneficiariesNumber: validBeneficiaryCount
    };
}

async function getCommunities() {
    communityAdmin = await ethers.getContractAt(
        "CommunityAdminImplementation",
        communityAdminAddress
    );

    communityListLength = (await communityAdmin.communityListLength()).toNumber();
    // communityListLength = 2;

    console.log('communityListLength: ', communityListLength);

    let getCommunityAddressPromises = [];


    for (let index = 0; index < communityListLength; index++) {
        getCommunityAddressPromises.push(parseCommunity(index));
    }

    await Promise.all(getCommunityAddressPromises);

    console.log('after getCommunityAddressPromises');

    let maxBeneficiariesNumber = 0
    let totalBeneficiariesNumber = 0
    let totalValidBeneficiariesNumber = 0
    for (let index = 0; index < communityListLength; index++) {
        totalValidBeneficiariesNumber += communities[index].validBeneficiariesNumber;
        totalBeneficiariesNumber += communities[index].beneficiariesNumber;
        if (communities[index].beneficiariesNumber > maxBeneficiariesNumber) {
            maxBeneficiariesNumber = communities[index].beneficiariesNumber;
        }
    }

    console.log('maxBeneficiariesNumber: ', maxBeneficiariesNumber);
    console.log('totalBeneficiariesNumber: ', totalBeneficiariesNumber);
    console.log('totalValidBeneficiariesNumber: ', totalValidBeneficiariesNumber);

    fs.writeFileSync("results/communities.json", JSON.stringify(communities), function (err: any) {
        if (err) {
            return console.log(err);
        }
    });
}

async function getCommunityBeneficiary(communityAddress: any, index: number): Promise<void> {
    let community = await ethers.getContractAt(
        "CommunityImplementation",
        communityAddress
    );

    let beneficiaryAddress = await community.beneficiaryListAt(index);
    let beneficiaryState = ((await community.beneficiaries(beneficiaryAddress)).state);
    if (beneficiaryState == 1) {
        beneficiaries.push(beneficiaryAddress);
    }
}

async function getBeneficiaries(communities: any) {
    let getCommunityBeneficiaryPromises = [];

    let chunkSize = 100;
    let counter = 0;
    for(let indexCommunities = 0; indexCommunities < communityListLength; indexCommunities++) {
        const community: Community = communities[indexCommunities];

        for(let indexBeneficiaries = 0; indexBeneficiaries < community.beneficiariesNumber; indexBeneficiaries++) {
            getCommunityBeneficiaryPromises.push(getCommunityBeneficiary(community.address, indexBeneficiaries));

            if (getCommunityBeneficiaryPromises.length == chunkSize) {
                console.log('batch #', counter++);
                await Promise.all(getCommunityBeneficiaryPromises);
                getCommunityBeneficiaryPromises = [];
            }
        }
    }

    await Promise.all(getCommunityBeneficiaryPromises);

    // let chunkSize = 100;
    // let counter = 0;
    // while (getCommunityBeneficiaryPromises.length > 0) {
    //     counter++;
    //     console.log('batch #' , counter, '; ', getCommunityBeneficiaryPromises.length, ' beneficiaries left');
    //     const batch = getCommunityBeneficiaryPromises.splice(0, chunkSize)
    //     await Promise.all(batch);
    // }

    console.log('totalValidBeneficiariesNumber 2: ', beneficiaries.length);

    fs.writeFileSync("results/beneficiaries.json", JSON.stringify(beneficiaries), function (err: any) {
        if (err) {
            return console.log(err);
        }
    });
}

async function main() {
    await getCommunities();
    await getBeneficiaries(communities);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
