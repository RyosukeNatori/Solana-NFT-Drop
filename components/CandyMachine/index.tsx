import {
  fetchCandyMachine,
  mintV2,
  mplCandyMachine,
  safeFetchCandyGuard,
} from '@metaplex-foundation/mpl-candy-machine';
import type {
  CandyGuard as CandyGuardType,
  CandyMachine as CandyMachineType,
  StartDate as StartDateType,
} from '@metaplex-foundation/mpl-candy-machine';
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-essentials';
import { mplTokenMetadata } from '@metaplex-foundation/mpl-token-metadata';
import {
  generateSigner,
  Option,
  publicKey,
  some,
  transactionBuilder,
} from '@metaplex-foundation/umi';
import type { Umi as UmiType } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { nftStorageUploader } from '@metaplex-foundation/umi-uploader-nft-storage';

import candyMachineStyles from './CandyMachine.module.css';

import styles from '@/styles/Home.module.css';
import { useEffect, useState } from 'react';

type CandyMachineProps = {
  walletAddress: any;
};

const CandyMachine = (props: CandyMachineProps) => {
  const { walletAddress } = props;
  // コンポーネント内にstateプロパティを追加します。
  const [umi, setUmi] = useState<UmiType | undefined>(undefined);
  const [candyMachine, setCandyMachine] = useState<
    CandyMachineType | undefined
  >(undefined);
  const [candyGuard, setCandyGuard] = useState<CandyGuardType | null>(null);
  const [startDateString, setStartDateString] = useState<Date | undefined>(
    undefined
  );
  const [isMinting, setIsMinting] = useState(false);

  const mintToken = async (
    candyMachine: CandyMachineType,
    candyGuard: CandyGuardType
  ) => {
    setIsMinting(true);
    try {
      if (umi === undefined) {
        throw new Error('Umi context was not initialized.');
      }
      if (candyGuard.guards.solPayment.__option === 'None') {
        throw new Error('Destination of solPayment is not set.');
      }

      const nftSigner = generateSigner(umi);
      const destination = candyGuard.guards.solPayment.value.destination;

      // トランザクションの構築を行います。
      const transaction = transactionBuilder()
        .add(setComputeUnitLimit(umi, { units: 600_000 }))
        .add(
          mintV2(umi, {
            candyGuard: candyGuard.publicKey,
            candyMachine: candyMachine.publicKey,
            collectionMint: candyMachine.collectionMint,
            collectionUpdateAuthority: candyMachine.authority,
            mintArgs: {
              solPayment: some({ destination: destination }),
            },
            nftMint: nftSigner,
          })
        );

      // トランザクションを送信して、ネットワークによる確認を待ちます。
      await transaction.sendAndConfirm(umi).then((response) => {
        const transactionResult = response.result.value;
        if (transactionResult.err) {
          console.error(`Failed mint: ${transactionResult.err}`);
        }
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsMinting(false);
    }
  };

  const getCandyMachineState = async () => {
    try {
      if (
        process.env.NEXT_PUBLIC_SOLANA_RPC_HOST &&
        process.env.NEXT_PUBLIC_CANDY_MACHINE_ID
      ) {
        // Candy Machineと対話するためのUmiインスタンスを作成し、必要なプラグインを追加します。
        const umi = createUmi(process.env.NEXT_PUBLIC_SOLANA_RPC_HOST)
          .use(walletAdapterIdentity(walletAddress))
          .use(nftStorageUploader())
          .use(mplTokenMetadata())
          .use(mplCandyMachine());
        // Candy Machineからメタデータを取得します。
        const candyMachine = await fetchCandyMachine(
          umi,
          publicKey(process.env.NEXT_PUBLIC_CANDY_MACHINE_ID)
        );
        const candyGuard = await safeFetchCandyGuard(
          umi,
          candyMachine.mintAuthority
        );

        // 取得したデータをコンソールに出力します。
        console.log(`items: ${JSON.stringify(candyMachine.items)}`);
        console.log(`itemsAvailable: ${candyMachine.data.itemsAvailable}`);
        console.log(`itemsRedeemed: ${candyMachine.itemsRedeemed}`);
        if (candyGuard?.guards.startDate.__option !== 'None') {
          console.log(`startDate: ${candyGuard?.guards.startDate.value.date}`);

          const startDateString = new Date(
            Number(candyGuard?.guards.startDate.value.date) * 1000
          );
          console.log(`startDateString: ${startDateString}`);
        }
        if (candyGuard?.guards.startDate.__option !== 'None') {
          console.log(`startDate: ${candyGuard?.guards.startDate.value.date}`);

          const startDateString = new Date(
            Number(candyGuard?.guards.startDate.value.date) * 1000
          );
          console.log(`startDateString: ${startDateString}`);
          // 取得したデータをstate変数に保存します。
          setStartDateString(startDateString);
        }

        // 取得したデータをstate変数に保存します。
        setUmi(umi);
        setCandyMachine(candyMachine);
        setCandyGuard(candyGuard);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    getCandyMachineState();
  }, []);

  return candyMachine && candyGuard ? (
    <div className={candyMachineStyles.machineContainer}>
      <p>{`Drop Date: ${startDateString}`}</p>
      <p>
        {`Items Minted: ${candyMachine.itemsRedeemed} / ${candyMachine.data.itemsAvailable}`}
      </p>
      <button
        className={`${styles.ctaButton} ${styles.mintButton}`}
        onClick={() => mintToken(candyMachine, candyGuard)}
        disabled={isMinting}
      >
        Mint NFT
      </button>
    </div>
  ) : null;
};

export default CandyMachine;
