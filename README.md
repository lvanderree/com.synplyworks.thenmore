# Timer - add Timers to temporarily turn on devices

*FKA Then More

This app adds More functionality to the Then... clause of your flows, to be able to turn (dimmed) devices on for a period of time.

## How does it work?
* Create a flow with for example a motion sensor, but basically anything you like as a trigger in the When... clause
* Add a Timer-card to the Then... clause of your flow
  * Select an OnOff device, or scroll to the Dimable device card
  * Enter the amount of seconds to keep the device on
  * You can configure to not activate the device (with the associated off timer), when the device is already on.
  * When you have multiple flows, activating the same device, but with different durations, you can also define to set the duration to the current configured time, even when it's shorter than the time left in the running timer.

When the flow (or another flow with the same device entered in the Timer card) is triggered again, the timer gets reset, and the device is kept on for a longer period of time.

Feel free to add multiple Timer-cards in the same flow, or select the same device in more than one flow via the Timer-cards.

## Todo
* Add functionality to handle external triggers that turned off devices

## Known issues
* Version 0.4.2 does not run on Homey V1.5. This compatibility issue is not defined in the package.json so 0.4.2 is revoked, and replaced by 0.5.0 

## Version 0.6.1 β
Homey V2: fixed settings page could contain timers that where expired

## Version 0.6.0 β
Homey V2: cancel timer when light turned off manually, handle name changes of devices

## Version 0.5.0 β
Homey V2 compatibility: changed api call to change device state

## Version 0.4.1 
added details view on a timer in the settings page

## Version 0.4.0 β
added settings page, to see and cancel running timers

## Version 0.3.1
fixed a bug that prevented timers could get reset

## Version 0.3.0 β
added extra feature on dim card
* restore previous dim level

## Version 0.2.0 β
added 2 extra cards
* condition: is timer running
* action: cancel running timer

## Version 0.1.0 β
initial release
