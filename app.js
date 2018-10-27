'use strict';

const Homey = require('homey');
const { HomeyAPI  } = require('athom-api')

class ThenMoreApp extends Homey.App {
	
	onInit() {
		this.log('ThenMore App is initializing...')

		this.allDevices = null
		
		this.getApi().then(api => {
			api.devices.on('device.create', async(id) => {
				await console.log('New device found!')
				this.allDevices = null
			})
			api.devices.on('device.delete', async(id) => {
				await console.log('Device deleted!')
				this.allDevices = null
			})
		})
			
		// this.getOnOffDevices() // TODO: init for drop down
		this.initFlowCards()
		
		this.log('ThenMore App is running...')
	}

	initFlowCards() {
		new Homey.FlowCardAction('then_more_dim')
			.register()
			.registerRunListener( args => {
				return this.sendNotification('Doe iets met device ' + args.device.id );
			})
			.getArgument('device')
				.registerAutocompleteListener( (query, args) => {
					return this.getDimDevices().then( dimDevices => {
						let filteredResults = dimDevices.filter( device => {
							return device.name.toLowerCase().indexOf( query.toLowerCase() ) > -1;
						})

						return Promise.resolve(filteredResults);
					})
			})

		new Homey.FlowCardAction('then_more_on_off')
			.register()
			.registerRunListener( args => {
				return this.sendNotification('Doe iets met device ' + args.device.id );
			})
			.getArgument('device')
				.registerAutocompleteListener( (query, args) => {
					return this.getOnOffDevices().then( onOffDevices => {
						let filteredResults = onOffDevices.filter( device => {
							return device.name.toLowerCase().indexOf( query.toLowerCase() ) > -1;
						})

						return Promise.resolve(filteredResults);
					})
			})

	}

	sendNotification(message) {
		new Homey.Notification({
			excerpt: message
		}).register()
	}
	
	// Get API control function
	getApi() {
		if (!this.api) {
			this.api = HomeyAPI.forCurrentHomey();
		}

		return this.api;
	}

	// Get all devices function for API
	async getAllDevices() {
		const api = await this.getApi();

		if (this.allDevices == null)
		{
			this.allDevices = Object.values(await api.devices.getDevices())
			this.log(`total devices: ${this.allDevices.length}`)
		}
		
		return this.allDevices;
	}

	/**
	 * load all devices from Homey
	 * and filter all without on/off capability
	 */
	async getOnOffDevices() {
		let onOffdevices = (await this.getAllDevices()).filter(device => {
			return (
				'onoff' in device.capabilities &&
				device.capabilities.onoff.setable
			)
		});

		this.log(`OnOff devices: ${onOffdevices.length}`)

		return onOffdevices;
	}

	/**
	 * load all devices from Homey
	 * and filter all without on/off capability
	 */
	async getDimDevices() {
		let dimdevices = (await this.getAllDevices()).filter(device => {
			return (
				'dim' in device.capabilities &&
				device.capabilities.dim.setable
			)
		});

		this.log(`Dimable devices: ${dimdevices.length}`)

		return dimdevices;
	}

}

module.exports = ThenMoreApp;