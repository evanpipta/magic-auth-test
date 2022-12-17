import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import React, { useEffect, useState } from "react";
import createMagicWalletAdapter from "./walletAdapter";
import { toast } from "react-toastify";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";

const rpcUrl = "https://api.devnet.solana.com";
const magic = createMagicWalletAdapter(rpcUrl);

const banks = [
  {
    decimals: 9,
    mint: new PublicKey("So11111111111111111111111111111111111111112"),
    symbol: "SOL",
  },
  {
    decimals: 6,
    mint: new PublicKey("8zGuJQqwhZafTah7Uc7Z4tXRnguqkn5KLFAP8oV6PHe2"),
    symbol: "USDC",
  },
  {
    decimals: 6,
    mint: new PublicKey("3BZPwbcqB5kKScF3TEXxwNfx5ipV13kbRVDvfVp5c6fv"),
    symbol: "BTC",
  },
];

const connection = new Connection(rpcUrl, "finalized");

const AssetRow = (bank) => {
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState("");
  const [destinationString, setDestinationString] = useState(
    "AUjVmgWDd6FrtwsVpoJ9Wpf55iauvbaNqbxjeRZ7ajY9"
  );

  const destinationPublicKey = new PublicKey(destinationString);

  const handleSend = async () => {
    setSubmitting(true);

    // const toastId = `transfer-${transferAmount}-${
    //   bank.symbol
    // }-${destinationAddress}-${Date.now()}`;

    toast("Signing Tx");

    try {
      const { blockhash } = await connection.getLatestBlockhash("finalized");

      const sendTx = new Transaction({
        feePayer: magic.publicKey,
        recentBlockhash: blockhash,
      });

      if (bank.symbol === "SOL") {
        sendTx.add(
          SystemProgram.transfer({
            fromPubkey: magic.publicKey,
            toPubkey: destinationPublicKey,
            lamports: amount * Math.pow(10, bank.decimals),
          })
        );
      } else {
        const destAtaPublicKey = await getAssociatedTokenAddress(
          bank.mint,
          destinationPublicKey
        );
        const sourceAtaPublicKey = await getAssociatedTokenAddress(
          bank.mint,
          magic.publicKey
        );

        // console.log(`${sourceAtaPublicKey}`);
        // console.log(`${destAtaPublicKey}`);

        let destAtaExists = false;
        try {
          const destAtaInfo = await connection.getAccountInfo(destAtaPublicKey);
          destAtaExists = !!destAtaInfo;
        } catch (e) {
          console.log(e);
          destAtaExists = false;
        }

        // console.log('destAtaExists', destAtaExists);
        // console.log(destAtaPublicKey.toString());

        if (!destAtaExists) {
          sendTx.add(
            createAssociatedTokenAccountInstruction(
              magic.publicKey,
              destAtaPublicKey,
              magic.publicKey,
              bank.mint
            )
          );
        }

        const transferCheckedIx = createTransferCheckedInstruction(
          sourceAtaPublicKey,
          bank.mint,
          destAtaPublicKey,
          magic.publicKey,
          Number(amount) * Math.pow(10, bank.decimals),
          bank.decimals
        );

        // const transferCheckedIx = Token.createTransferInstruction(
        // 	ASSOCIATED_TOKEN_PROGRAM_ID,
        // 	sourceAtaPublicKey,
        // 	destAtaPublicKey,
        // 	magic.publicKey,
        // 	[],
        // 	Number(transferAmountBase)
        // );

        sendTx.add(transferCheckedIx);

        // This does not work. I don't know why. It says "invalid instruction". RIP.
        console.log(transferCheckedIx);
      }

      const signed = await magic.signTransaction(sendTx);
      toast(`Sending ${amount} ${bank.symbol}`);
      const txSig = await connection.sendRawTransaction(signed.serialize());
      toast(`Success! \n\ntxSig: ${txSig}`);
      setSubmitting(false);
    } catch (error) {
      console.log(error);
      // TODO pretty error? Not sure how likely it is to get here.
      toast(`error: ${error}`);
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ paddingY: "8px" }}>
        <h3>Send {bank.symbol}</h3>
      </div>
      {submitting ? (
        <div>Sending...</div>
      ) : (
        <>
          <input
            value={destinationString}
            onChange={(e) => setDestinationString(e.target.value)}
            placeholder={"Address"}
          />
          <br />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={"Amount"}
          />
          <br />
          <button onClick={handleSend}>Send</button>
        </>
      )}
    </div>
  );
};

const WalletUI = () => {
  const [connecting, setConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    magic.on("connect", () => {
      setIsConnected(true);
      setConnecting(false);
    });
    magic.on("disconnect", () => {
      setIsConnected(false);
    });
  }, []);

  const handleConnect = () => {
    setConnecting(true);
    magic.connect({
      email,
    });
  };

  if (!isConnected) {
    return (
      <div style={{ paddingTop: "20px" }}>
        {connecting ? (
          <h1>Connecting...</h1>
        ) : (
          <>
            <h1>Connect wallet</h1>
            <div style={{ paddingTop: "20px" }}>
              <input value={email} onChange={(e) => setEmail(e.target.value)} />
              <button onClick={handleConnect}>Connect</button>
            </div>
          </>
        )}
      </div>
    );
  } else {
    return (
      <div style={{ paddingTop: "20px" }}>
        <h1>Connected to {magic.publicKey?.toString()}</h1>
        <div style={{ paddingTop: "20px" }}>
          {banks.map((bank) => {
            return <AssetRow {...bank} />;
          })}
        </div>
      </div>
    );
  }
};

export default WalletUI;
