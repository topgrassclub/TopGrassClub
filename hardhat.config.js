require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
	defaultNetwork: "polygonAmoy",
	solidity: {
		version: "0.8.24",
		settings: {
			optimizer: {
				enabled: true,
				runs: 200
			}
		}
	},
	networks: {
		hardhat: {},
		polygonAmoy: {
			url: "https://rpc-amoy.polygon.technology",
			accounts: [process.env.PRIVATE_KEY],
			chainId: 80002
		}
	},
	etherscan: {
		apiKey: process.env.POLYGON_API_KEY,
		customChains: [
			{
				network: "polygonAmoy",
				chainId: 80002,
				urls: {
				  apiURL: "https://api-amoy.polygonscan.com/api",
				  browserURL: "https://amoy.polygonscan.com/"
				}
			}
		]
	}
};