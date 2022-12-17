import { Magic } from "magic-sdk";
import { SolanaExtension } from "@magic-ext/solana";
import { PublicKey } from "@solana/web3.js";
import EventEmitter from "events";

export class MagicAuthAdapter extends EventEmitter {
  constructor(rpcUrl) {
    super();

    this.magic = new Magic("pk_live_FCB6980D19DE9D57", {
      extensions: [
        new SolanaExtension({
          rpcUrl,
        }),
      ],
    });
  }

  async signTransaction(tx) {
    const serializeConfig = {
      requireAllSignatures: false,
      verifySignatures: true,
    };

    const { signature } = await this.magic?.solana?.signTransaction(
      tx,
      serializeConfig
    );

    // The above signTransaction serializes the tx already, which we don't want to happen yet here, so just add the signatures it generated to the original tx and return that
    signature?.forEach(({ signature }) => {
      if (signature) {
        tx.addSignature(this.publicKey, signature);
      }
      // Also, retryTxSender.ts in the sdk expects the tx to be modified in place when the wallet signs it instead of getting a new one returned, so this also avoids needing to update the sdk
    });

    return tx;
  }

  async signAllTransactions(txes) {
    const signedTxes = await Promise.all(
      txes.map(async (tx) => await this.signTransaction(tx))
    );
    return signedTxes;
  }

  // Extra step required for this adapter:
  // If the user selected magic as the wallet, instead of just calling connect, you have to allow the user to either enter their email or click one of the social login buttons
  // After they do that, then call connect and pass in the results (e.g. their email address or social auth token)
  connect = async (options) => {
    await this.magic?.auth?.loginWithMagicLink({
      showUI: false,
      ...options,
    });
    const metaData = await this.magic?.user?.getMetadata();
    this.publicKey = new PublicKey(metaData.publicAddress);
    this.connected = true;
    this.emit("connect");
  };

  disconnect = async () => {
    await this.magic?.user?.logout();
    window.localStorage?.removeItem("magicAuthSavedEmail");
    window.localStorage?.removeItem("preferredWallet");
    this.publicKey = undefined;
    this.connected = false;
    this.emit("disconnect");
  };
}

const createMagicWalletAdapter = (rpcUrl) => {
  const adapter = new MagicAuthAdapter(rpcUrl);
  return adapter;
};

export default createMagicWalletAdapter;
