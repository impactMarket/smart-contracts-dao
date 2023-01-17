import {ethers} from "ethers";

async function main() {
    const wallet = ethers.Wallet.createRandom()

    console.log('address:', wallet.address)
    console.log('privateKey:', wallet.privateKey)
}


main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
