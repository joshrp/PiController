console.log(process.env.NEXT_RUNTIME);
if (process.env.NEXT_RUNTIME === 'nodejs') {
  import('../../../gamepad/inputs').then(m => m.main());
  console.log('Gamepad registered');
}
