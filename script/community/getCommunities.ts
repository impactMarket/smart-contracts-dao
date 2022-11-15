// @ts-ignore
import {ethers, config, network} from "hardhat";
import {fromEther, toEther} from "../../test/utils/helpers";

// mainnet
const communityAdminAddress = "0xd61c407c3A00dFD8C355973f7a14c55ebaFDf6F9";

// // alfajores
// const communityAdminAddress = "0x1c33D75bcE52132c7a0e220c1C338B9db7cf3f3A";

let communityAdmin: any;

let communities: any[] = [];

async function getCommunity(index: number): Promise<void> {
    communities.push((await communityAdmin.communityListAt(index)).toString());
}

async function getCommunities() {
    communityAdmin = await ethers.getContractAt(
        "CommunityAdminImplementation",
        communityAdminAddress
    );

    const communityListLength = (await communityAdmin.communityListLength()).toNumber();

    console.log('communityListLength 1: ', communityListLength);

    let getCommunityAddressPromises = [];


    for(let index = 0; index < communityListLength; index++) {
        getCommunityAddressPromises.push(getCommunity(index));
    }

    await Promise.all(getCommunityAddressPromises);

    console.log('communityListLength 2: ', communities.length);
}

async function main() {
    await getCommunities();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
