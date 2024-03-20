const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const fromWei = (value) => {
  return Number(ethers.formatEther(value));
};

const toWei = (value) => {
  return ethers.parseUnits(value.toString(), "ether");
};
describe("Lock", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployContractAndSetVariables() {
    const supplyToken = 5 * 10 ** 5;
    // Contracts are deployed using the first signer/account by default
    const [owner, user1, user2] = await ethers.getSigners();
    const Contract = await ethers.getContractFactory("MultiSwap");
    const contract = await Contract.deploy();

    const Token = await ethers.getContractFactory("MyToken");
    const infiToken = await Token.deploy("infi", "IF", toWei(supplyToken));
    const curveToken = await Token.deploy("curve", "CR", toWei(supplyToken));
    const zetToken = await Token.deploy("zet", "ZE", toWei(supplyToken));

    const nativeTokenAddr = "0x0000000000000000000000000000000000000000";
    await infiToken.connect(user1).approve(await contract.getAddress(), toWei(supplyToken));
    await curveToken.connect(user1).approve(await contract.getAddress(), toWei(supplyToken));
    await infiToken.connect(owner).approve(await contract.getAddress(), toWei(supplyToken));
    await curveToken.connect(owner).approve(await contract.getAddress(), toWei(supplyToken));
    await infiToken.connect(owner).transfer(user1.address, toWei(5 * 10 ** 2));
    await curveToken.connect(owner).transfer(user1.address, toWei(5 * 10 ** 2));
    return {
      contract,
      owner,
      user1,
      infiToken,
      curveToken,
      zetToken,
      nativeTokenAddr,
    };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { contract, owner } = await loadFixture(deployContractAndSetVariables);

      expect(await contract.admin()).to.equal(owner.address);
    });
  });

  describe("Check set Rate function successfully", async function () {
    it("Check set Rate function with token => token success", async function () {
      const { contract, owner, infiToken, curveToken } = await loadFixture(deployContractAndSetVariables);
      const infiTokenAddress = await infiToken.getAddress();
      const curveTokenAddress = await curveToken.getAddress();

      const rate = 20;
      const check = async (token1, token2) => {
        await contract.connect(owner).setRate(token1, token2, rate);
        const rate1 = await contract.getRate(token1, token2);
        expect(Number(rate1)).to.equal(rate);
      };
      await check(infiTokenAddress, curveTokenAddress);
    });

    it("Check set Rate function with token => native token success", async function () {
      const { contract, owner, infiToken, curveToken, nativeTokenAddr } = await loadFixture(
        deployContractAndSetVariables
      );
      const infiTokenAddress = await infiToken.getAddress();
      const curveTokenAddress = await curveToken.getAddress();

      const rate = 20;
      const check = async (token1, token2) => {
        await contract.connect(owner).setRate(token1, token2, rate);
        const rate1 = await contract.getRate(token1, token2);
        console.log({ rate1, rate }, "come to set rate");
        expect(Number(rate1)).to.equal(rate);
      };
      check(infiTokenAddress, nativeTokenAddr);
    });

    // it("Check set Rate function with native token => token success", async function () {
    //   check(nativeTokenAddr, ice.address);
    // });
  });
  describe("Check set Rate function fail", async function () {
    const { contract, owner, infiToken, curveToken, user1 } = await loadFixture(deployContractAndSetVariables);
    const rate = 50;
    const userAddress = await user1.getAddress();
    const infiTokenAddress = await infiToken.getAddress();
    const curveTokenAddress = await curveToken.getAddress();
    const tokenInAmount = 10;
    it("msg.sender isn't owner", async function () {
      await expect(contract.connect(userAddress).setRate(infiTokenAddress, curveTokenAddress, rate)).to.be.revertedWith(
        "Ownable: caller is not the owner"
      );
    });
  });

  describe("Check swap token successfully", async function () {
    this.beforeEach(async function () {
      const { contract, owner, user1, infiToken, curveToken, nativeTokenAddr } = await loadFixture(
        deployContractAndSetVariables
      );
      const infiTokenAddress = await infiToken.getAddress();
      const curveTokenAddress = await curveToken.getAddress();
      // set rate & deposit first
      const depositAmount = 100;
      const rateInfiTokenToCurveValue = 50;
      const rateCurveToInfiValue = 60;
      const tokenInAmount = 10;
      //Set Rate
      await contract.connect(owner).setRate(infiTokenAddress, curveTokenAddress, rateInfiTokenToCurveValue);
      await contract.connect(owner).setRate(infiTokenAddress, nativeTokenAddr, rateCurveToInfiValue);
      //Add Pool
      await contract.connect(owner).depositToken(nativeTokenAddr, toWei(depositAmount), {
        value: toWei(depositAmount),
      });
      await contract.connect(user1).depositToken(infiTokenAddress, toWei(depositAmount));
      await contract.connect(user1).depositToken(curveTokenAddress, toWei(depositAmount));
      await contract.connect(owner).depositToken(infiTokenAddress, toWei(depositAmount));
      await contract.connect(owner).depositToken(curveTokenAddress, toWei(depositAmount));
    });
    it("Swap token to token", async function () {
      const { contract, owner, user1, infiToken, curveToken, nativeTokenAddr } = await loadFixture(
        deployContractAndSetVariables
      );
      const infiTokenAddress = await infiToken.getAddress();
      const curveTokenAddress = await curveToken.getAddress();
      // set rate & deposit first
      const depositAmount = 100;
      const rateInfiTokenToCurveValue = 50;
      const rateCurveToInfiValue = 60;
      const tokenInAmount = 10;
      //Set Rate

      const user1Address = await user1.getAddress();
      const contractAddress = await contract.getAddress();

      const tokenOutAmount = Number((tokenInAmount * rateInfiTokenToCurveValue) / 10 ** 18);
      console.log({ tokenOutAmount });
      const balanceInfiInit = Number(fromWei(await infiToken.balanceOf(user1Address)));
      const balanceCurveiInit = Number(fromWei(await curveToken.balanceOf(user1Address)));
      const res = await contract.connect(user1).swap(infiTokenAddress, curveTokenAddress, toWei(tokenInAmount));
      const balanceInfiFinal = Number(fromWei(await infiToken.balanceOf(user1Address)));
      const balanceCurveFinal = Number(fromWei(await curveToken.balanceOf(user1Address)));
      console.log({ balanceCurveFinal, balanceCurveiInit, tokenOutAmount });
      expect(balanceInfiInit).to.equal(balanceInfiFinal + tokenInAmount);
      expect(balanceCurveFinal).to.equal(balanceCurveiInit - tokenOutAmount);
    });
  });

  describe("Check swap token function fail", async function () {
    it("Swap token to token", async function () {
      const { contract, owner, user1, infiToken, curveToken, nativeTokenAddr } = await loadFixture(
        deployContractAndSetVariables
      );
      const infiTokenAddress = await infiToken.getAddress();
      const curveTokenAddress = await curveToken.getAddress();
      // set rate & deposit first
      const depositAmount = 100;
      const rateInfiTokenToCurveValue = 50;
      const rateCurveToInfiValue = 60;
      await contract.connect(user1).depositToken(infiTokenAddress, toWei(depositAmount));
      await contract.connect(user1).depositToken(curveTokenAddress, toWei(depositAmount));
      await contract.connect(owner).depositToken(infiTokenAddress, toWei(depositAmount));
      await contract.connect(owner).depositToken(curveTokenAddress, toWei(depositAmount));
      await expect(contract.connect(user1).swap(infiTokenAddress, curveTokenAddress, 0)).to.be.revertedWith(
        "Invalid amount"
      );
    });

    it("Swap token to native token", async function () {
      const { contract, owner, user1, infiToken, curveToken, nativeTokenAddr } = await loadFixture(
        deployContractAndSetVariables
      );
      const infiTokenAddress = await infiToken.getAddress();
      const curveTokenAddress = await curveToken.getAddress();
      // set rate & deposit first
      const depositAmount = 100;
      const rateInfiTokenToCurveValue = 50;
      const rateCurveToInfiValue = 60;
      await expect(contract.connect(user1).swap(infiTokenAddress, nativeTokenAddr, 0)).to.be.revertedWith(
        "Invalid amount"
      );
    });
    //
    it("Swap native token to token", async function () {
      const { contract, owner, user1, infiToken, curveToken, nativeTokenAddr } = await loadFixture(
        deployContractAndSetVariables
      );
      const infiTokenAddress = await infiToken.getAddress();
      const curveTokenAddress = await curveToken.getAddress();
      // set rate & deposit first
      const depositAmount = 100;
      const rateInfiTokenToCurveValue = 50;
      const rateCurveToInfiValue = 60;
      await expect(
        contract.connect(user1).swap(nativeTokenAddr, curveTokenAddress, 0, { value: 0 })
      ).to.be.revertedWith("Amount must be greater than 0");
    });
  });
});
