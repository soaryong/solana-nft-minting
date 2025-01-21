import {
  createNft,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  createGenericFile,
  generateSigner,
  keypairIdentity,
  percentAmount,
  publicKey,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import {
  airdropIfRequired,
  getExplorerLink,
  getKeypairFromFile,
} from "@solana-developers/helpers";
import { clusterApiUrl, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { promises as fs } from "fs";
import * as path from "path";

const main = async () => {
  // create a new connection to Solana's devnet cluster
  const connection = new Connection(clusterApiUrl("devnet"));

  const umi = createUmi(connection);

  // load keypair from local file system
  // See https://github.com/solana-developers/helpers?tab=readme-ov-file#get-a-keypair-from-a-keypair-file
  const user = await getKeypairFromFile("");

  // convert to umi compatible keypair
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(user.secretKey);

  // assigns a signer to our umi instance, and loads the MPL metadata program and Irys uploader plugins.
  umi
    .use(keypairIdentity(umiKeypair))
    .use(mplTokenMetadata())
    .use(irysUploader());

  const collectionImagePath = path.resolve(__dirname, "collection.png");

  const buffer = await fs.readFile(collectionImagePath);
  let file = createGenericFile(buffer, collectionImagePath, {
    contentType: "image/png",
  });
  const [image] = await umi.uploader.upload([file]);
  console.log("image uri:", image);

  // upload offchain json to Arweave using irys
  const uri = await umi.uploader.uploadJson({
    name: "My Collection",
    symbol: "MC",
    description: "My Collection description",
    image,
  });
  console.log("Collection offchain metadata URI:", uri);

  // generate mint keypair
  const collectionMint = generateSigner(umi);

  // create and mint NFT
  await createNft(umi, {
    mint: collectionMint,
    name: "My Collection",
    uri,
    updateAuthority: umi.identity.publicKey,
    sellerFeeBasisPoints: percentAmount(0),
    isCollection: true,
  }).sendAndConfirm(umi, { send: { commitment: "finalized" } });

  let explorerLink = getExplorerLink(
    "address",
    collectionMint.publicKey,
    "devnet"
  );
  console.log(`Collection NFT:  ${explorerLink}`);
  console.log(`Collection NFT address is:`, collectionMint.publicKey);
  console.log("✅ Finished successfully!");

  const collectionPublicKey = publicKey(collectionMint.publicKey);

  const nftImagePath = path.resolve(__dirname, "nft.png");
  const nftBuffer = await fs.readFile(nftImagePath);
  let nftFile = createGenericFile(nftBuffer, nftImagePath, {
    contentType: "image/png",
  });
  const [nftImage] = await umi.uploader.upload([nftFile]);
  console.log("NFT image uri:", nftImage);

  const nftUri = await umi.uploader.uploadJson({
    name: "My NFT Item",
    symbol: "NFT",
    description: "This is my NFT item description",
    image,
    attributes: [
      {
        trait_type: "Background",
        value: "Blue",
      },
      {
        trait_type: "Rarity",
        value: "Rare",
      },
    ],
  });
  console.log("NFT metadata URI:", uri);

  const nftMint = generateSigner(umi);

  await createNft(umi, {
    mint: nftMint,
    name: "My NFT Item",
    uri,
    sellerFeeBasisPoints: percentAmount(5),
    collection: {
      key: collectionPublicKey,
      verified: false,
    },
  }).sendAndConfirm(umi, { send: { commitment: "finalized" } });

  let nftExplorerLink = getExplorerLink("address", nftMint.publicKey, "devnet");
  console.log(`NFT:  ${nftExplorerLink}`);
  console.log(`NFT address is:`, nftMint.publicKey);
  console.log("✅ NFT created successfully!");
};

main();
