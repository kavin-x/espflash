"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Unplug, ShieldCheck, PlugZap, HardDriveDownload } from "lucide-react";

import { ESPLoader, FlashOptions, LoaderOptions, Transport } from "esptool-js";
var CryptoJS = require("crypto-js");

import { useState } from "react";

import { Terminal } from "@xterm/xterm";
import "./xterm.css";

import { useRef, useEffect } from "react";
import { Dispatch, SetStateAction } from "react";


let device: SerialPort;
let transport: Transport;
let chip: string;
let esploader: ESPLoader;
let baudrate: string = "921600";
let p: Response;
let f: Response;
let b: Response;
let o: Response;

const term = new Terminal({ cols: 100, rows: 20 });

const espLoaderTerminal = {
  clean() {
    term.clear();
  },
  writeLine(data: string) {
    term.writeln(data);
    term.scrollToBottom();
    // console.log(data);
    // terminal = terminal.concat(data);
  },
  write(data: string) {
    term.write(data);
    term.scrollToBottom();
    // console.log(data);
    // terminal = terminal.concat(data);
  },
};

async function connect(
  setconn: Dispatch<SetStateAction<boolean>>,
  setprog: Dispatch<SetStateAction<boolean>>
) {
    device = await navigator.serial.requestPort({});
    transport = new Transport(device, true);

  try {
    const flashOptions = {
      transport,
      baudrate: parseInt(baudrate),
      terminal: espLoaderTerminal,
    } as LoaderOptions;
    esploader = new ESPLoader(flashOptions);

    chip = await esploader.main();

    // Temporarily broken
    // await esploader.flashId();
  } catch (e: any) {
    console.error(e);
    // term.writeln(`Error: ${e.message}`);
    console.log(`Error: ${e.message}`);
  } finally {
    setconn(true);
    const utf = "https://utfs.io/f/";
    const partitions = utf + "28bc3d21-0a23-4787-98f2-b35b8599e1c4-o3361.bin";
    const firmware = utf + "aee1113f-095e-46d8-868e-551cf99a89bd-96mszp.bin";
    const bootloader = utf + "e0b2cb9b-bcf5-4e2b-888a-f83d1fe17f5d-v9g86z.bin";
    const otadata = utf + "e5633ab9-3bfb-4ee4-a032-654c694cde84-xaimjo.bin";
    p = await fetch(partitions);
    f = await fetch(firmware);
    b = await fetch(bootloader);
    o = await fetch(otadata);
    setprog(false);
  }
}

const TerminalComponent = () => {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // const terminal = new Terminal();
    // term.loadAddon(fitAddon);
    if (!terminalRef.current) throw Error("divRef is not assigned");
    term.open(terminalRef?.current);

    // fitAddon.fit();
    // Customize further as needed
    // return () => {
    //   terminal.dispose();
    // };
  }, []);

  return <div className="rounded-full border-0" ref={terminalRef} />;
};

function utob(u8Array: Uint8Array) {
  let bStr = "";
  for (let i = 0; i < u8Array.length; i++) {
    bStr += String.fromCharCode(u8Array[i]);
  }
  return bStr;
}

async function program() {
  // console.log("Implementation Pending");

  let boot = new Uint8Array(await b.arrayBuffer());
  let part = new Uint8Array(await p.arrayBuffer());
  let firm = new Uint8Array(await f.arrayBuffer());
  let ota = new Uint8Array(await o.arrayBuffer());

  let fileArray = [];
  fileArray.push({ data: utob(boot), address: parseInt("0x1000") });
  fileArray.push({ data: utob(part), address: parseInt("0x8000") });
  fileArray.push({ data: utob(ota), address: parseInt("0xe000") });
  fileArray.push({ data: utob(firm), address: parseInt("0x10000") });

  // console.log(fileArray[0].data);
  // console.log(fileArray[1].address);
  // console.log(fileArray[2].address);
  // console.log(fileArray[3].address);

  // console.log(fileArray);

  // let progressBars = [];

  try {
    const flashOptions: FlashOptions = {
      fileArray: fileArray,
      flashSize: "keep",
      eraseAll: false,
      compress: true,
      calculateMD5Hash: (image) =>
        CryptoJS.MD5(CryptoJS.enc.Latin1.parse(image)),
      // reportProgress: (fileIndex, written, total) => {
      // progressBars[fileIndex].value = (written / total) * 100;
      // },
    } as FlashOptions;
    await esploader.writeFlash(flashOptions);
  } catch (e: any) {
    console.error(e);
    term.writeln(`Error: ${e.message}`);
  } finally {
    // Hide progress bars and show erase buttons
    // for (let index = 1; index < table.rows.length; index++) {
    //   table.rows[index].cells[2].style.display = "none";
    //   table.rows[index].cells[3].style.display = "initial";
    // }
    console.log("Programming Done");
  }
}

async function reset() {
  await esploader.hardReset();
  console.log("Reset!");
}

async function license() {
  let key = new Uint8Array(4096);
  self.crypto.getRandomValues(key);
  let macaddr = await esploader.chip.readMac(esploader);
  const mac = macaddr.split(":");
  let sum: number = 0;
  mac.map((value) => {
    // console.debug(parseInt(value, 16));
    sum += parseInt(value, 16);
  });
  console.debug("Sum: " + sum);
  let arri = sum + 0xa00;
  console.debug("Array Index: ", arri);
  console.debug("Values at that location: ");
  for (let i = 0; i < 6; i++) {
    console.debug(key[arri + i].toString(16));
  }

  let secret = [100, 108, 119, 114, 109, 97];

  console.debug("New Values at that location: ");
  for (let i = 0; i < 6; i++) {
    key[arri + i] = parseInt(mac[i], 16) ^ secret[i];
    console.debug(key[arri + i].toString(16));
  }

  let fileArray = [];
  fileArray.push({ data: utob(key), address: parseInt("0x2d0000") });

  try {
    const flashOptions: FlashOptions = {
      fileArray: fileArray,
      flashSize: "keep",
      eraseAll: false,
      compress: true,
      calculateMD5Hash: (image) =>
        CryptoJS.MD5(CryptoJS.enc.Latin1.parse(image)),
      // reportProgress: (fileIndex, written, total) => {
      // progressBars[fileIndex].value = (written / total) * 100;
      // },
    } as FlashOptions;
    await esploader.writeFlash(flashOptions);
  } catch (e: any) {
    console.error(e);
    term.writeln(`Error: ${e.message}`);
  } finally {
    // Hide progress bars and show erase buttons
    // for (let index = 1; index < table.rows.length; index++) {
    //   table.rows[index].cells[2].style.display = "none";
    //   table.rows[index].cells[3].style.display = "initial";
    // }
    console.log("Programming Done");
  }
}

export default function Home() {
  // const terminal = document.getElementById("terminal");
  // const [term, setTerm] = useState('');
  const termi = useRef(null);
  console.log(termi.current);
  // term.open(termi.current);
  const [conn, setconn] = useState(false);
  const [prog, setprog] = useState(true);

  return (
    <div className="gap-1.5 pl-4 pt-4">
      <div className="flex gap-1.5 p-4">
        {conn ? (
          <div></div>
        ) : (
          <Button
            onClick={() => {
              connect(setconn, setprog);
            }}
          >
            <PlugZap className="mr-2 h-4 w-4" />
            Connect
          </Button>
        )}

        {conn ? (
          <div className="flex gap-1.5">
            <Button
              onClick={() => {
                program();
              }}
              disabled={prog}
            >
              <HardDriveDownload className="mr-2 h-4 w-4" />
              Program
            </Button>
            <Button
              onClick={() => {
                license();
              }}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              License
            </Button>

            <Button
              onClick={() => {
                device.close();
                setconn(false);
              }}
            >
              <Unplug className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
          </div>
        ) : (
          <div></div>
        )}
      </div>
      {/* <InputFile /> */}
      {/* <Term data={terminal}></Term> */}
      <div className="flex max-w-10 pl-4">
        <TerminalComponent />
      </div>
    </div>
  );
}
