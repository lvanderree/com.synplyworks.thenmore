'use strict';

const Homey = require('homey');
const { HomeyAPI  } = require('athom-api')

class ThenMoreApp extends Homey.App {
	
	onInit() {
		this.log('ThenMore App is initializing...')

		// remember timeoutIds per device
		this.timers = [];

		this.cache = {}
		// invalidate cache when devices are added/removed
		this.getApi().then(api => {
			api.devices.on('device.create', async(id) => {
				await console.log('New device added, reset cache!')
				this.cache = {}
			})
			api.devices.on('device.delete', async(id) => {
				await console.log('Device deleted, reset cache!')
				this.cache = {}
			})
		})
			
		this.initFlowCards()

		this.log('ThenMore App is running...')
	}

	initFlowCards() {
		new Homey.FlowCardAction('then_more_dim')
			.register()
			.registerRunListener( args => {
				return this.runScript( 
					args.device, 
					{ 'capability': 'dim', 'value': args.brightness_level },
					args.time_on,
					args.ignore_when_on,
					args.overrule_longer_timeouts,
					args.restore
				);
			})
			// TODO: DRY registerAutocompleteListener
			.getArgument('device')
				.registerAutocompleteListener( (query, args) => {
					return this.getDimDevices().then( dimDevices => {
						let filteredResults = dimDevices.filter( device => {
							return (
								device.name.toLowerCase().indexOf( query.toLowerCase() ) > -1
							) || (
								device.zone.name.toLowerCase().indexOf( query.toLowerCase() ) > -1
							)
						})

						return Promise.resolve(filteredResults);
					})
				})


		new Homey.FlowCardAction('then_more_on_off')
			.register()
			.registerRunListener( args => {
				return this.runScript( 
					args.device, 
					{ 'capability': 'onoff', 'value': true },
					args.time_on,
					args.ignore_when_on,
					args.overrule_longer_timeouts
				);
			})
			.getArgument('device')
				.registerAutocompleteListener( (query, args) => {
					return this.getOnOffDevices().then( onOffDevices => {
						let filteredResults = onOffDevices.filter( device => {
							return (
								device.name.toLowerCase().indexOf(query.toLowerCase()) > -1
							) || ( 
								device.zone.name.toLowerCase().indexOf(query.toLowerCase()) > -1
							)
						})

						return Promise.resolve(filteredResults);
					})
				})

		new Homey.FlowCardAction('cancel_timer')
			.register()
			.registerRunListener( args => {
				return this.cancelTimer( 
					args.device, 
				);
			})
			.getArgument('device')
				.registerAutocompleteListener( (query, args) => {
					return this.getOnOffDevices().then( onOffDevices => {
						let filteredResults = onOffDevices.filter( device => {
							return (
								device.name.toLowerCase().indexOf(query.toLowerCase()) > -1
							) || ( 
								device.zone.name.toLowerCase().indexOf(query.toLowerCase()) > -1
							)
						})

						return Promise.resolve(filteredResults);
					})
				})
			
		new Homey.FlowCardCondition('is_timer_running')
			.register()
			.on('run', ( args, state, callback ) => {
				if (this.isTimerRunning(args.device)) {
					callback( null, true )
				}
				else {
					callback( null, false )
				}
			})
			.getArgument('device')
				.registerAutocompleteListener( (query, args) => {
					return this.getOnOffDevices().then( onOffDevices => {
						let filteredResults = onOffDevices.filter( device => {
							return (
								device.name.toLowerCase().indexOf(query.toLowerCase()) > -1
							) || ( 
								device.zone.name.toLowerCase().indexOf(query.toLowerCase()) > -1
							)
						})

						return Promise.resolve(filteredResults);
					})
				})
	}

	async runScript(device, action, timeOn, ignoreWhenOn, overruleLongerTimeouts, restore = "no") {

		const api = await this.getApi();
		let oldValue = null;

		// run script when...
		if (
			// ... ignoring current on-state
			(ignoreWhenOn == "no") ||
			// .. or when previously activated by this script (and when overrule longer, or new timer is later)
			(
				device.id in this.timers && 
				((overruleLongerTimeouts == "yes") || (new Date().getTime() + timeOn * 1000 > this.timers[device.id].offTime))
			) ||
			// or when device is off
			(await api.devices.getDeviceCapabilityState({id: device.id, capability: 'onoff'}) == false)
		) {
			// first check if there is a reference for a running timer for this device
			if (this.isTimerRunning(device)) {
				this.cancelTimer(device)
			} else {
				// if not already running, turn device on (else leaf it as it is)
				this.log(`Turn ${device.id} on`);
				// if restore is set to on, and the device is currently on, remember current value
				if (restore == "yes" && await api.devices.getDeviceCapabilityState({id: device.id, capability: 'onoff'})) {
					this.log(`remember state for ${device.id} (since on and restore on)`);
					oldValue = await api.devices.getDeviceCapabilityState({id: device.id, capability: action.capability});
				}
				await api.devices.setDeviceCapabilityState({id: device.id, capability: action.capability, value: action.value, timeOn: timeOn});
			}
			
			// (re)set timeout
			let timeoudId = setTimeout(function (device, capability, oldValue) {
				this.log(`Timeout ${device.id}`);

				if (!oldValue) {
					this.turnOff(device);
				} else {
					this.setDeviceCapabilityState(device, capability, oldValue)
				}
				
				// remove reference of timer for this device
				delete this.timers[device.id];
				Homey.ManagerApi.realtime('timer_deleted', { timers: this.exportTimers(), device: device });
			}.bind(this, device, action.capability, oldValue), timeOn * 1000);
			
			// remember reference of timer for this device and when it will end
			this.timers[device.id] = {id: timeoudId, device: device, offTime: new Date().getTime() + timeOn * 1000};
			// tell the world the timer is (re)started
			Homey.ManagerApi.realtime('timer_started', {timers: this.exportTimers(), device: device, capability: action.capability, value: action.value});
		}

		return Promise.resolve(true)
	}

	isTimerRunning(device) {
		let hasTimer = device.id in this.timers;
		
		if (hasTimer) {
			this.log(`Timer for device ${device.id} found` );
		} else {
			this.log(`Timer for device ${device.id} not found` );
		}
		return hasTimer;
	}

	cancelTimer(device) {
		this.log(`Cancel timer for device ${device.id}`);

		if (device.id in this.timers) {
			// if timer is running cancel timer and remove reference
			clearTimeout(this.timers[device.id].id);
			this.log(`Cancelled timer for device ${device.id}`);
			delete this.timers[device.id];

			Homey.ManagerApi.realtime('timer_deleted',  { timers: this.exportTimers(), device: device });
		}

		return Promise.resolve(true)
	}

	// turn of a device
	turnOff(device) {
		this.setDeviceCapabilityState(device, 'onoff', false)
	}

	// set a device to a certain state
	async setDeviceCapabilityState(device, capability, value) {
		this.log(`set device ${device.id} - ${capability} to ${value}!!` );

		const api = await this.getApi();
		await api.devices.setDeviceCapabilityState({id: device.id, capability: capability, value: value});
	}
		
	// Get API control function
	getApi() {
		if (!this.api) {
			this.api = HomeyAPI.forCurrentHomey();
		}

		return this.api;
	}

	// Get Timers
	exportTimers() {
		let data = {};

		for (let key in this.timers) {
			data[key] = Object.assign({}, this.timers[key]);
			delete data[key].id; // remove timeout id which cannot be exported
		}

		return data;
	}

	// Get all devices function for API
	async getAllDevices() {
		if (!this.cache.allDevices) {
			const api = await this.getApi();

			this.cache.allDevices = Object.values(await api.devices.getDevices())
			this.log(`Update ${this.cache.allDevices.length} devices in total in cache`)
		}
		
		return this.cache.allDevices;
	}

	/**
	 * load all devices from Homey
	 * and filter all without on/off capability
	 */
	async getOnOffDevices() {
		if (!this.cache.onOffDevices)	{ 
			this.cache.onOffDevices = (await this.getAllDevices()).filter(device => {
				return (
					'onoff' in device.capabilities &&
					device.capabilities.onoff.setable
				)
			});

			this.log(`Update ${this.cache.onOffDevices.length} OnOff devices in cache`)
		}

		return this.cache.onOffDevices;
	}

	/**
	 * load all devices from Homey
	 * and filter all without on/off capability
	 */
	async getDimDevices() {
		if (!this.cache.dimDevices)	{ 
			this.cache.dimDevices = (await this.getAllDevices()).filter(device => {
				return (
					'dim' in device.capabilities &&
					device.capabilities.dim.setable
				)
			});
			
			this.log(`Update ${this.cache.dimDevices.length} Dimable devices in cache`)
		}

		return this.cache.dimDevices;
	}

}

module.exports = ThenMoreApp;