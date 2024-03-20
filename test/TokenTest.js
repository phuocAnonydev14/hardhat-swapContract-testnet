const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const fromWei = (value) => {
  return Number(ethers.formatEther(value));
};

const toWei = (value) => {
  return ethers.parseUnits(value.toString(), "ether");
};
describe("Token", async function () {
  let deployer, token;
  const supply = 5 * 10 ** 4;
  beforeEach(async function () {
    const TOKEN = await ethers.getContractFactory("MyToken");
    [deployer, addr1, addr2] = await ethers.getSigners();
    token = await TOKEN.deploy("phuoc","p",toWei(supply));
  });

  describe("Deployment", function () {
    it("Mint and check the token", async function () {
      expect(fromWei(await token.totalSupply())).to.equal(supply);
      expect(fromWei(await token.balanceOf(deployer.address))).to.equal(supply);
    });
  });
});
