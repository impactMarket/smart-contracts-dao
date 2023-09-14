// @ts-ignore
import {ethers, config, deployments} from "hardhat";
import {toEther} from "../../test/utils/helpers";


const MicrocreditProxyOldAddress = "0xEa4D67c757a6f50974E7fd7B5b1cc7e7910b80Bb";
const MicrocreditProxyAddress = "0xa3811f2e46D22d99C27A16f6208E9AaB04E1A98B";
const cUSDAddress = "0x765DE816845861e75A25fCA122bb6898B8B1282a";

const deployerAddress = "0xa34737409091eBD0726A3Ab5863Fc7Ee9243Edab";
const ownerAddress = "0x0497b572842a178445fC29EbDDf6B220C40eE384";

// const borrowerAddress = "0x19Fa2976a8D55a8D733Da471d6Dcc1A308572B72";
const borrowerAddress = "0x4b240c005dc16156e78fce87cb5bce5e3c0e4831";

const sponsorAddress = "0xCA31c88C2061243D70eb3a754E5D99817a311270";

const bugAddress = "0x091033aDC7fBdd4a1109c938585bfB54d0Fcf051";

async function test() {
  const MicrocreditOld = await ethers.getContractAt("MicrocreditImplementation", MicrocreditProxyOldAddress);
  const Microcredit = await ethers.getContractAt("MicrocreditImplementation", MicrocreditProxyAddress);
  const cUSD = await ethers.getContractAt("TokenMock", cUSDAddress);


  await ethers.provider.send("hardhat_impersonateAccount", [deployerAddress]);
  const deployer = await ethers.provider.getSigner(deployerAddress);

  await ethers.provider.send("hardhat_impersonateAccount", [ownerAddress]);
  const owner = await ethers.provider.getSigner(ownerAddress);

  await ethers.provider.send("hardhat_impersonateAccount", [borrowerAddress]);
  const borrower = await ethers.provider.getSigner(borrowerAddress);

  await ethers.provider.send("hardhat_impersonateAccount", [sponsorAddress]);
  const sponsor = await ethers.provider.getSigner(sponsorAddress);

  await ethers.provider.send("hardhat_impersonateAccount", [bugAddress]);
  const bug = await ethers.provider.getSigner(bugAddress);

  await deployer.sendTransaction({
      to: ownerAddress,
      value: toEther(1)
  });

  await deployer.sendTransaction({
    to: borrowerAddress,
    value: toEther(1)
  });

  await deployer.sendTransaction({
    to: sponsorAddress,
    value: toEther(1)
  });

  await deployer.sendTransaction({
    to: bugAddress,
    value: toEther(1)
  });

  await cUSD.connect(sponsor).transfer(borrowerAddress, toEther(300));



  // const microcreditImplementationResult = await deployments.deploy(
  //   "MicrocreditImplementation",
  //   {
  //     from: deployerAddress,
  //     args: [],
  //     log: true,
  //   }
  // );


  // const accounts: SignerWithAddress[] = await ethers.getSigners();
  // const deployer = accounts[0];

  // console.log(fromEther(await ethers.provider.getBalance(user1Address)));
  // await deployer.sendTransaction({
  //     to: user1Address,
  //     value: toEther(2)
  // });
  // console.log(fromEther(await ethers.provider.getBalance(user1Address)));




  // await Microcredit.connect(owner).addManagers([deployerAddress], [toEther(1000)]);
  //
  // console.log(await Microcredit.managers(deployerAddress));
  //
  //
  // // await Microcredit.connect(deployer).addLoans([borrowerAddress], [toEther(100)], [10000000000000], [0], [1000000000000]);
  // let loan = await Microcredit.userLoans(borrowerAddress, 0);
  // console.log('after creation: ', loan);
  //
  // // await Microcredit.connect(borrower).claimLoan(0);
  // loan = await Microcredit.userLoans(borrowerAddress, 0);
  // console.log('after claim: ', loan);
  //
  // await cUSD.connect(borrower).approve(MicrocreditProxyAddress, toEther(1000));
  // await Microcredit.connect(borrower).repayLoan(0, toEther(300));
  // loan = await Microcredit.userLoans(borrowerAddress, 0);
  // console.log('after repay: ', loan);
  //
  //
  //
  // await Microcredit.connect(deployer).addLoans([borrowerAddress], [toEther(200)], [10000000000000], [0], [1000000000000]);
  // let loan2 = await Microcredit.userLoans(borrowerAddress, 1);
  // console.log('after creation2: ', loan2);
  //
  // await Microcredit.connect(borrower).claimLoan(1);
  // loan2 = await Microcredit.userLoans(borrowerAddress, 1);
  // console.log('after claim2: ', loan2);
  //
  // await Microcredit.connect(borrower).repayLoan(1, toEther(200));
  // loan2 = await Microcredit.userLoans(borrowerAddress, 1);
  // console.log('after repay2: ', loan2);





  // console.log(1);
  //
  // await Microcredit.connect(deployer).addLoans([bugAddress], [toEther(200)], [10000000000000], [0], [1000000000000]);
  //
  // console.log(2);




  // let metadata: any;
  // for (let i = 0; i < 236; i++) {
  //   let walletListAt = await MicrocreditOld.walletListAt(i);
  //   try {
  //     metadata = await MicrocreditOld.walletMetadata(walletListAt);
  //
  //     console.log(i);
  //     if (metadata.movedTo != ethers.constants.AddressZero) {
  //       console.log(metadata)
  //     }
  //
  //
  //
  //     // if (metadata.loansLength == 1) {
  //     //   let loan = await Microcredit.userLoans(walletListAt, 0);
  //     //
  //     //   if (loan.dailyInterest.toString() != '100000000000000000' && loan.dailyInterest != '200000000000000000' && loan.dailyInterest != '120000000000000000') {
  //     //     console.log('***************************************************')
  //     //     console.log(walletListAt);
  //     //     console.log(loan);
  //     //     console.log('***************************************************')
  //     //   }
  //     // }
  //
  //
  //
  //     // await Microcredit.userLoans(walletListAt, 0)
  //     // if (metadata.loansLength > 1) {
  //     //   console.log('++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
  //     //   console.log(`Multiple ok loans for ${walletListAt}`)
  //     //   console.log(metadata)
  //     //   console.log('++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
  //     // }
  //   } catch (e) {
  //     console.log('------------------------------------------------------------------------------');
  //     console.log(`error for ${walletListAt}`)
  //     console.log(metadata)
  //     console.log('------------------------------------------------------------------------------');
  //   }
  // }

  let managerLength  = await MicrocreditOld.managerListLength();

  let managersAddresses = [];
  let managersCurrentLentAmountLimit = [];
  let managersCurrentLentAmount = [];

  for(let index = 0; index<managerLength; index++) {
    let managerAddress = await MicrocreditOld.managerListAt(index);
    let manager = await MicrocreditOld.managers(managerAddress);

    managersAddresses.push(managerAddress);
    managersCurrentLentAmountLimit.push(manager.currentLentAmountLimit);
    managersCurrentLentAmount.push(manager.currentLentAmount);
  }

  console.log(managersAddresses)
  console.log(managersCurrentLentAmountLimit)
  console.log(managersCurrentLentAmount)
}


async function main() {
  await test();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
