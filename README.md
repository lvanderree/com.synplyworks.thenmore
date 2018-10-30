# Then More

Adds More functionality in the Then... clause of your flows, to be able to turn (dimmed) devices on for a period of time.

Simply add a ThenMore card one or more times to the Then... clause of your flow, select an OnOff, or Dimable device and enter the amount of seconds to keep the device on.

When the flow (or another flow with the same device entered in the ThenMore card) is triggered again, the timer gets reset, and the device is kept on for a longer period of time.

You can configure to not activate the device (with the associated off timer), when the device is already on.
When you have multiple flows, activating the same device, but with different durations, you can also configure to set the duration to the current configured time, even when it's shorter than the time left in the running timer.
