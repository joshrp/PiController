"use client";

import { Button, Flex, ProgressRoot, ProgressSection, ProgressLabel, Badge, Dialog, Center } from '@mantine/core';
import { IconCircleCheckFilled, IconCircleXFilled, IconRefresh } from '@tabler/icons-react';

import { useState } from 'react';
import { Loader, Text } from '@mantine/core';
import { DeviceResp } from "./types";


export function Device(props: { device: DeviceResp, key: string }) {
  console.log(props.device.name);
  const name = props.device.name;
  const charge = props.device.info?.upower?.percentage
  let chargeValue = -1;
  if (charge)
    chargeValue = parseInt(charge.slice(0, charge.indexOf('%')), 10);

  let color = 'green';
  if (chargeValue < 20) {
    color = 'red';
  } else if (chargeValue < 50) {
    color = 'orange';
  }
  const [loading, setLoading] = useState(false);
  const [DialogOpened, setDialogOpened] = useState(false);
  const [PairResult, setPairResult] = useState(false);

  const handleFixDevice = async () => {
    if (loading) return;
    setLoading(true);
    console.log(`http://192.168.4.105:3002/fix?mac=${props.device.mac}`);
    try {
      const result = await (await fetch(`http://192.168.4.105:3002/fix?mac=${props.device.mac}`)).json();
      setPairResult(result);
    } catch (error) {
      setPairResult(false);
    } finally {
      setLoading(false);
      setDialogOpened(true);
    }
  };
  return (
    <Flex direction="column" align="center" justify="center" gap={10}>
      <h2>
        {name}
      </h2>
      <img
        src={`/static/${props.device.image}`}
        style={{ width: 100, minHeight: 70 }}
      />
      {props.device.connected ? (
        <ProgressRoot size="xl" style={{ alignSelf: "stretch" }}>
          <ProgressSection value={chargeValue} color={color}>
            <ProgressLabel>{charge ?? '??'}</ProgressLabel>
          </ProgressSection>
        </ProgressRoot>
      ) : (
        <Badge color="orange" size="xs">Not Connected</Badge>
      )}

      <Button onClick={handleFixDevice} rightSection={loading == false ? <IconRefresh size={14} /> : ""}>
        {loading ? <Loader size="xs" color='white' variant="dots" /> : "Re-Pair"}
      </Button>
      <Dialog opened={DialogOpened} withCloseButton onClose={() => { setDialogOpened(false) }} size="lg" radius="md">
        <Flex align="center" direction="row">
        {PairResult ? (<>
          <IconCircleCheckFilled size={26} color="white" fill='green' />
          <Text size="sm" ml="xs" fw={500} c="black">
            Pairing {name} successful
          </Text>
        </>) : (<>
          <IconCircleXFilled size={26} color="white" fill='red' />
          <Text size="sm" ml="xs" fw={500} c="black">
            Failed to pair {name}
          </Text>
        </>)}
        </Flex>
      </Dialog>

    </Flex>
  );
}
