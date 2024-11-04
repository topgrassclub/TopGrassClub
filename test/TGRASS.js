const {expect} = require("chai");
const {ethers} = require("hardhat");
const {Signature} = require("ethers");


describe('TGRASS', () => {
    let tokenContract;
    let tokenInstance;
    let owner;
    let addr1;
    let addr2;

    let MONTH_IN_SECONDS = 2629743;

    beforeEach(async () => {
        tokenContract = await ethers.getContractFactory("TGRASS");
        [owner, addr1, addr2] = await ethers.getSigners();
        tokenInstance = await tokenContract.deploy(owner.address);
    })

    describe('Deployment', () => {

        it('should set right name and symbol', async () => {
            expect(await tokenInstance.symbol()).to.equal("TGRASS");
            expect(await tokenInstance.name()).to.equal("Top Grass Club");
        });

        it('should set right owner of contract', async () => {
            expect(await tokenInstance.owner()).to.equal(owner.address);
        });

        it('should mint 800_000_000 tokens', async () => {
            const expectedAmount = ethers.parseEther("800000000")
            expect(await tokenInstance.balanceOf(owner.address)).to.equal(expectedAmount);
        });

        it('should emit TokensMinted event', async () => {
            await expect(tokenInstance.deploymentTransaction())
                .to.emit(tokenInstance, "TokensMinted")
                .withArgs(ethers.parseEther("800000000"));
        });
    });

    describe('burn()', () => {

        it('should revert if burn more tokens than owner have', async () => {
            await expect(tokenInstance.burn(ethers.parseEther("900000000")))
                .to.revertedWithCustomError(tokenContract, "ERC20InsufficientBalance")
                .withArgs(owner, ethers.parseEther("800000000"), ethers.parseEther("900000000"));
        });

        it('should burn right amount of tokens', async () => {
            await tokenInstance.burn(ethers.parseEther("100000000"));
            const expectedAmount = ethers.parseEther("700000000")
            expect(await tokenInstance.balanceOf(owner.address)).to.equal(expectedAmount);
        });

        it('should emit TokensBurned event', async () => {
            await expect(tokenInstance.burn(ethers.parseEther("100000000")))
                .to.emit(tokenInstance, "TokensBurned")
                .withArgs(owner.address, ethers.parseEther("100000000"));
        });
    });

     describe('burnFrom()', () => {
        beforeEach(async () => {
            const allowanceAmount = ethers.parseEther("900000000");

            const deadline = (await ethers.provider.getBlock('latest')).timestamp + MONTH_IN_SECONDS;
            const domains = {
                name: "Top Grass Club",
                version: "1",
                chainId: (await ethers.provider.getNetwork()).chainId,
                verifyingContract: tokenInstance.target,
            }
            const types = {
                Permit: [
                        {
                            name: "owner",
                            type: "address"
                        },
                        {
                            name: "spender",
                            type: "address"
                        },
                        {
                            name: "value",
                            type: "uint256"
                        },
                        {
                            name: "nonce",
                            type: "uint256"
                        },
                        {
                            name: "deadline",
                            type: "uint256"
                        },
                  ],
                }
            const values = {
                owner: owner.address,
                spender: addr1.address,
                value: allowanceAmount,
                nonce: await tokenInstance.nonces(owner.address),
                deadline: deadline,
            }

            const signature = await owner.signTypedData(domains, types, values);
            const {v, r, s} = await Signature.from(signature)
            await tokenInstance.permit(owner.address, addr1.address, allowanceAmount, deadline, v, r, s);
        });

        it('should burn right amount of tokens', async () => {
            const allowance = await tokenInstance.allowance(owner.address, addr1.address);
            expect(allowance).to.equal(ethers.parseEther("900000000"));

            await tokenInstance.connect(addr1).burnFrom(owner.address, ethers.parseEther("100000000"));
            const ownerBalance = await tokenInstance.balanceOf(owner.address);

            expect(ownerBalance).to.equal(ethers.parseEther("700000000"))
        });

        it('should emit TokensBurned event', async () => {

            await expect(tokenInstance.connect(addr1)
                .burnFrom(owner.address, ethers.parseEther("100000000")))
                .to.emit(tokenInstance, "TokensBurned").withArgs(owner.address, ethers.parseEther("100000000"));
        });

        it('should revert if user wants to burn more tokens than account have', async () => {
            await expect(tokenInstance.connect(addr1)
                .burnFrom(owner.address, ethers.parseEther("900000000")))
                .to.revertedWithCustomError(tokenContract, "ERC20InsufficientBalance")
                .withArgs(owner.address, ethers.parseEther("800000000"), ethers.parseEther("900000000"));
        });

         it('should revert without allowance', async () => {
            await expect(tokenInstance.connect(addr2)
                .burnFrom(owner.address, ethers.parseEther("100000000")))
                .to.revertedWithCustomError(tokenContract, "ERC20InsufficientAllowance")
                .withArgs(addr2.address, 0, ethers.parseEther("100000000"));
         });

     });
});