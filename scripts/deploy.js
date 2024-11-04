require("dotenv").config();

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  const TGRASS = await ethers.getContractFactory("TGRASS");
  const TGCVesting = await ethers.getContractFactory("TGCVesting");

  const TGRASS_INITIAL_ADDRESS = "0x925028Ad8f5249af93219EFE209A2171E9346bec"
  const tgrass = await TGRASS.deploy(TGRASS_INITIAL_ADDRESS);
  console.log("TGRASS: " + await tgrass.target);

  const TGE_TIMESTAMP = 12000000;
  const tgcVesting = await TGCVesting.deploy(
      tgrass.target,
      TGE_TIMESTAMP
  );
  console.log("TGCVesting: " + await tgcVesting.target);


}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
