/**
 * @file src/module/merchant-shop.ts
 * handles the merchant shop interface using applicationv2
 **/

import { FLAGS, MODULE_ID } from './constants.js';
import { get_flag, set_flag, calculate_price, get_actor_currency } from './utils.js';
import { SocketHandler } from './socket-handler.js';
import { MerchantManager } from './merchant-manager.js';
import { MerchantItemEditor } from './merchant-item-editor.js';
import { MerchantServiceEditor } from './merchant-service-editor.js';

const { ApplicationV2, HandlebarsApplicationMixin } = ( foundry.applications.api as any );

/**
 * @class MerchantShop
 * the primary interface for players to interact with a merchant
 **/
export class MerchantShop extends ( HandlebarsApplicationMixin( ApplicationV2 ) as any ) 
{
	public token: any;

	constructor( token: any, options: any = { } ) 
	{
		super( options );
		this.token = token;
	}

	static DEFAULT_OPTIONS = 
	{
		id: 'yugen-merchant-shop',
		tag: 'form',
		classes: [ 
			'yugen-merchant', 
			'shop' 
		],
		window: 
		{
			title: 'yugen-merchant-shop',
			controls: [ ],
			resizable: true
		},
		position: 
		{
			width: 500,
			height: 600
		}
	};

	static PARTS = 
	{
		header: 
		{
			template: 'modules/yugen-merchant/templates/shop-header.hbs'
		},
		content: 
		{
			template: 'modules/yugen-merchant/templates/shop-content.hbs'
		}
	};

	static TABS = 
	{
		shop: 
		{
			tabs: [
				{
					id: 'buy',
					label: 'Buy',
					icon: 'fas fa-shopping-cart'
				},
				{
					id: 'services',
					label: 'Services',
					icon: 'fas fa-hand-holding-heart'
				},
				{
					id: 'sell',
					label: 'Sell',
					icon: 'fas fa-coins'
				},
				{
					id: 'manage',
					label: 'Manage',
					icon: 'fas fa-cog',
					cssClass: 'gm-only'
				}
			],
			initial: 'buy',
			label: true
		}
	};

	static ACTIONS = 
	{
		buy: MerchantShop._on_buy,
		sell: MerchantShop._on_sell,
		tab: MerchantShop._on_tab,
		'show-sheet': MerchantShop._on_show_sheet,
		/** management actions **/
		'toggle-merchant': MerchantShop._on_toggle_merchant,
		'toggle-infinite': MerchantShop._on_toggle_infinite,
		'toggle-owner-manage': MerchantShop._on_toggle_owner_manage,
		'update-multiplier': MerchantShop._on_update_multiplier,
		'update-greeting': MerchantShop._on_update_greeting,
		'update-range': MerchantShop._on_update_range,
		'randomize-rarities': MerchantShop._on_randomize_rarities,
		'buy-service': MerchantShop._on_buy_service,
		'add-service': MerchantShop._on_add_service,
		'edit-service': MerchantShop._on_edit_service,
		'delete-service': MerchantShop._on_delete_service,
		'edit-item': MerchantShop._on_edit_item,
		'delete-item': MerchantShop._on_delete_item
	};

	static async _on_toggle_owner_manage( this: MerchantShop, event: any, target: HTMLInputElement ) 
	{
		await set_flag( this.token.document, FLAGS.ALLOW_OWNER_MANAGE, target.checked );
	}

	static async _on_update_greeting( this: MerchantShop, event: any, target: HTMLInputElement ) 
	{
		await set_flag( this.token.document, FLAGS.GREETING_MESSAGE, target.value );
	}

	static async _on_update_range( this: MerchantShop, event: any, target: HTMLInputElement ) 
	{
		await set_flag( this.token.document, FLAGS.INTERACTION_RANGE, parseInt( target.value ) || 0 );
	}

	/**
	 * checks if a user (or their controlled token) is within interaction range of the merchant
	 **/
	static check_proximity( merchant_token: any, notify: boolean = true ): boolean 
	{
		if ( ( game as any ).user.isGM ) 
		{
			return true;
		}

		/** check token first, then actor for range flag **/
		const doc = merchant_token.document;
		const range = get_flag( doc, FLAGS.INTERACTION_RANGE ) ?? get_flag( doc.actor, FLAGS.INTERACTION_RANGE ) ?? 10;
		
		if ( range <= 0 ) 
		{
			return true;
		}

		const player_token = ( canvas as any ).tokens?.controlled[ 0 ] || ( game as any ).user.character?.getActiveTokens( )[ 0 ];

		if ( !player_token ) 
		{
			if ( notify ) 
			{
				( ui as any ).notifications?.warn( 'Please control a token to shop.' );
			}
			return false;
		}

		/** V14 robust distance calculation using measurePath **/
		const waypoints = [ player_token.center, merchant_token.center ];
		const result = ( canvas as any ).grid.measurePath( waypoints );
		const distance = result.distance || 0;
		
		if ( distance > range ) 
		{
			if ( notify ) 
			{
				( ui as any ).notifications?.warn( ( game as any ).i18n.format( 'yugen-merchant.notifications.too-far', { range } ) );
			}
			return false;
		}

		return true;
	}

	/**
	 * returns the dynamic title for the application window
	 **/
	get title( ) 
	{
		return `yugen-merchant: ${ this.token.name }`;
	}

	/**
	 * prepares the context data for rendering
	 **/
	async _prepareContext( _options: any ) 
	{
		const doc = this.token.document;
		const is_gm = ( game as any ).user.isGM;

		/** proximity check for players **/
		if ( !MerchantShop.check_proximity( this.token ) ) 
		{
			this.close( );
			return { };
		}

		const inventory = get_flag( doc, FLAGS.INVENTORY ) ?? [ ];
		const services = get_flag( doc, FLAGS.SERVICES ) ?? [ ];
		
		/** fetch player character inventory for selling **/
		const player_actor = ( game as any ).user.character || ( canvas as any ).tokens?.controlled[ 0 ]?.actor;
		
		/** resolve allowed item types and value settings **/
		const allowed_types_str = ( game as any ).settings.get( MODULE_ID, 'item-types' ) || '';
		const allowed_types = allowed_types_str.split( ',' ).map( ( t: string ) => t.trim( ).toLowerCase( ) ).filter( ( t: string ) => t.length > 0 );
		const allow_zero = ( game as any ).settings.get( MODULE_ID, 'allow-zero-value' );

		const player_items = player_actor ? player_actor.items.contents
			.filter( ( item: any ) => 
			{
				/** filter out non-tradable item types if configured **/
				if ( allowed_types.length > 0 && !allowed_types.includes( item.type.toLowerCase( ) ) ) 
				{
					return false;
				}

				/** filter out zero-value items if setting is disabled **/
				if ( !allow_zero ) 
				{
					const price = calculate_price( 
						item.system?.price?.value || 0, 
						item.system?.rarity || 'common', 
						doc, 
						false 
					);
					if ( price <= 0 ) 
					{
						return false;
					}
				}

				return true;
			} )
			.map( ( item: any ) => 
			{
				return {
					id: item.id,
					name: item.name,
					img: item.img,
					price: calculate_price( 
						item.system?.price?.value || 0, 
						item.system?.rarity || 'common', 
						doc, 
						false 
					),
					quantity: item.system?.quantity || 1,
					denom: item.system?.price?.denomination || 'gp',
					description: item.system?.description?.value || ''
				};
			} ) : [ ];

		const buy_multiplier = Math.round( ( get_flag( doc, FLAGS.BUY_MULTIPLIER ) ?? 1.0 ) * 100 );
		const sell_multiplier = Math.round( ( get_flag( doc, FLAGS.SELL_MULTIPLIER ) ?? 0.5 ) * 100 );
		const is_infinite = get_flag( doc, FLAGS.INFINITE_FUNDS ) ?? false;
		const is_merchant = get_flag( doc, FLAGS.IS_MERCHANT ) ?? false;

		/** fetch merchant actor and currency data **/
		const merchant_actor = this.token.actor || doc.actor;
		const funds = get_actor_currency( merchant_actor );

		/** multipliers for management UI **/
		const quality_mults = get_flag( doc, FLAGS.QUALITY_MULTIPLIERS ) ?? { };
		const rarity_multipliers: any = { };
		for ( const [ key, val ] of Object.entries( quality_mults ) ) 
		{
			rarity_multipliers[ key ] = Math.round( ( val as number ) * 100 );
		}

		/** check if current user is manager **/
		const is_owner = this.token.actor?.testUserPermission( ( game as any ).user, 'OWNER' );
		const allow_owner_manage = get_flag( doc, FLAGS.ALLOW_OWNER_MANAGE ) ?? false;
		const can_manage = is_gm || ( is_owner && allow_owner_manage );

		/** encumbrance check for player character **/
		const current_encumbrance = player_actor?.system?.attributes?.encumbrance;
		const is_encumbered = current_encumbrance ? current_encumbrance.value >= current_encumbrance.max : false;

		/** filter tabs for non-managers and handle initial tab **/
		const tabs_config = ( foundry.utils as any ).duplicate( ( this.constructor as any ).TABS.shop );
		if ( !can_manage ) 
		{
			tabs_config.tabs = tabs_config.tabs.filter( ( t: any ) => t.id !== 'manage' );
		}
		
		/** if not a merchant, GM defaults to manage tab **/
		if ( is_gm && !is_merchant && !this.tabGroups.shop ) 
		{
			this.tabGroups.shop = 'manage';
		}

		return {
			is_gm,
			can_manage,
			is_encumbered,
			merchant: 
			{
				id: this.token.id,
				name: this.token.name,
				img: this.token.document.texture.src,
				funds: funds,
				is_infinite: is_infinite,
				is_merchant: is_merchant,
				greeting: get_flag( doc, FLAGS.GREETING_MESSAGE ) ?? '',
				allow_owner_manage: allow_owner_manage,
				interaction_range: get_flag( doc, FLAGS.INTERACTION_RANGE ) ?? 10
			},
			buy_multiplier,
			sell_multiplier,
			buy_items: inventory.map( ( item: any, index: number ) => 
			{
				const weight = item.system?.weight || 0;
				return {
					index: index,
					name: item.name,
					img: item.img,
					price: calculate_price( 
						item.system?.price?.value || 0, 
						item.system?.rarity || 'common', 
						doc, 
						true 
					),
					quantity: item.system?.quantity || 1,
					denom: item.system?.price?.denomination || 'gp',
					description: item.system?.description?.value || '',
					weight,
					/** warn if this item alone would encumber them, or they are already encumbered **/
					heavy: weight > 0 && is_encumbered
				};
			} ),
			services: services.map( ( s: any, index: number ) => 
			{
				return { ...s, index };
			} ),
			sell_items: player_items,
			rarity_multipliers,
			inventory,
			tabs: this._get_tabs_context( 'shop', tabs_config )
		};
	}

	/**
	 * actions performed only on first render
	 **/
	protected _onFirstRender( _context: any, _options: any ): void 
	{
		/** 
		 * single delegated click listener for all shop actions.
		 * this handles buy, sell, edit, delete, and tab switching robustly.
		 * we ignore inputs to prevent focus issues on click.
		 **/
		this.element.addEventListener( 'click', ( event: any ) => 
		{
			const target = event.target.closest( '[data-action]' );
			if ( target && ![ 'INPUT', 'SELECT', 'TEXTAREA' ].includes( target.tagName ) ) 
			{
				this._onAction( event, target );
			}
		} );

		/** delegated change listener for management inputs **/
		this.element.addEventListener( 'change', ( event: any ) => 
		{
			const target = event.target.closest( '[data-action]' );
			if ( target ) 
			{
				this._onAction( event, target );
			}
		} );

		/** drag and drop support for virtual inventory - added only once **/
		this.element.addEventListener( 'drop', this._on_drop.bind( this ) );
	}

	/**
	 * prepare the application for rendering
	 **/
	protected _onRender( context: any, options: any ): void 
	{
		super._onRender( context, options );

		/** handle greeting message for the user who opens the shop **/
		if ( context.merchant.is_merchant && context.merchant.greeting && !this._greeting_sent ) 
		{
			this._greeting_sent = true;
			( ChatMessage as any ).create( {
				content: context.merchant.greeting,
				speaker: ( ChatMessage as any ).getSpeaker( { token: this.token.document } ),
				whisper: [ ( game as any ).user.id ]
			} );
		}
	}

	/**
	 * routes actions from the template to static handlers
	 **/
	protected _onAction( event: any, target: HTMLElement ): void
	{
		const action = target.dataset.action;
		if ( !action ) 
		{
			return;
		}

		const handler = ( this.constructor as any ).ACTIONS[ action ];
		if ( handler ) 
		{
			handler.call( this, event, target );
		}
	}

	/**
	 * helper to generate tab context data
	 **/
	private _get_tabs_context( group: string, config_override: any = null ) 
	{
		const config = config_override || ( this.constructor as any ).TABS[ group ];
		const active = this.tabGroups[ group ] || config.initial;
		
		return Object.fromEntries( config.tabs.map( ( t: any ) => 
		{
			return [ 
				t.id, 
				{
					...t,
					group,
					active: t.id === active,
					cssClass: t.id === active ? 'active' : ''
				} 
			];
		} ) );
	}

	/**
	 * handle dropping items into the virtual inventory
	 **/
	private async _on_drop( event: DragEvent ) 
	{
		if ( !( game as any ).user.isGM ) 
		{
			return;
		}

		event.preventDefault( );
		const data_text = event.dataTransfer?.getData( 'text/plain' );
		if ( !data_text ) 
		{
			return;
		}

		try 
		{
			const data = JSON.parse( data_text );
			if ( data.type !== 'Item' ) 
			{
				return;
			}

			const item = await ( fromUuid as any )( data.uuid );
			if ( !item ) 
			{
				return;
			}

			const doc = this.token.document;
			await MerchantManager.add_to_inventory( doc, item.toObject( ) );
			this.render( );
		} 
		catch ( err ) 
		{
			console.error( `${ MODULE_ID } | drop error:`, err );
		}
	}

	static async _on_buy( this: MerchantShop, event: any, target: HTMLElement ) 
	{
		event.preventDefault( );
		const item_index = target.closest( '.shop-item' )?.getAttribute( 'data-item-index' );

		if ( item_index === null || item_index === undefined ) 
		{
			return;
		}

		const player_token = ( canvas as any ).tokens?.controlled[ 0 ] || ( game as any ).user.character?.getActiveTokens( )[ 0 ];
		const player_actor = player_token?.actor || ( game as any ).user.character;

		if ( !player_actor ) 
		{
			( ui as any ).notifications?.warn( 'please control a token to shop' );
			return;
		}

		/** if it is a synthetic token, use token ID for GM resolution fail-safe **/
		const target_id = player_token ? player_token.id : player_actor.id;

		await SocketHandler.emit_purchase( this.token.id, target_id, parseInt( item_index ) );
		this.render( );
	}

	static async _on_buy_service( this: MerchantShop, event: any, target: HTMLElement ) 
	{
		event.preventDefault( );
		const service_index = target.closest( '.shop-item' )?.getAttribute( 'data-service-index' );

		if ( service_index === null || service_index === undefined ) 
		{
			return;
		}

		const player_token = ( canvas as any ).tokens?.controlled[ 0 ] || ( game as any ).user.character?.getActiveTokens( )[ 0 ];
		const player_actor = player_token?.actor || ( game as any ).user.character;

		if ( !player_actor ) 
		{
			( ui as any ).notifications?.warn( 'please control a token to shop' );
			return;
		}

		/** if it is a synthetic token, use token ID for GM resolution fail-safe **/
		const target_id = player_token ? player_token.id : player_actor.id;

		await SocketHandler.emit_purchase_service( this.token.id, target_id, parseInt( service_index ), ( game as any ).user.id );
		this.render( );
	}

	/**
	 * handles selling an item to the merchant
	 **/
	static async _on_sell( this: MerchantShop, event: any, target: HTMLElement ) 
	{
		event.preventDefault( );
		const item_id = target.closest( '.shop-item' )?.getAttribute( 'data-item-id' );
		if ( !item_id ) 
		{
			return;
		}

		const player_actor = ( game as any ).user.character || ( canvas as any ).tokens?.controlled[ 0 ]?.actor;
		if ( !player_actor ) 
		{
			return;
		}

		await SocketHandler.emit_sale( this.token.id, player_actor.id, item_id );
		this.render( );
	}

	/**
	 * handles tab switching
	 **/
	static async _on_tab( this: MerchantShop, event: any, target: HTMLElement ) 
	{
		const group = target.dataset.group;
		const tab = target.dataset.tab;
		if ( group && tab ) 
		{
			this.changeTab( tab, group );
		}
	}

	/**
	 * opens the full item sheet for the selected item
	 **/
	static async _on_show_sheet( this: MerchantShop, event: any, target: HTMLElement ) 
	{
		event.preventDefault( );
		const item_row = target.closest( '.shop-item' ) as HTMLElement;
		if ( !item_row ) 
		{
			return;
		}

		const item_id = item_row.getAttribute( 'data-item-id' );
		const item_index = item_row.getAttribute( 'data-item-index' );

		console.log( `yugen-merchant | show-sheet | id: ${ item_id }, index: ${ item_index }` );

		try 
		{
			if ( item_id ) 
			{
				const player_actor = ( game as any ).user.character || ( canvas as any ).tokens?.controlled[ 0 ]?.actor;
				const item = player_actor?.items.get( item_id );
				if ( item ) 
				{
					item.sheet.render( { force: true } );
				}
			}
			else if ( item_index !== null ) 
			{
				const inventory = get_flag( this.token.document, FLAGS.INVENTORY ) ?? [ ];
				const item_data = inventory[ parseInt( item_index ) ];
				
				if ( item_data ) 
				{
					/** instantiate the item purely in memory using the proper V14 document class **/
					const item_cls = ( CONFIG as any ).Item.documentClass;
					const temp_item = new item_cls( ( foundry.utils as any ).duplicate( item_data ) );
					
					/** force ownership for viewing **/
					temp_item.updateSource( { 'ownership.default': 3 } );
					
					console.log( `yugen-merchant | rendering preview for ${ temp_item.name }` );
					
					/** ensure sheet exists and render it **/
					const sheet = temp_item.sheet;
					if ( sheet ) 
					{
						sheet.render( { force: true } );
					}
					else 
					{
						console.error( 'yugen-merchant | item preview error: no sheet found for item' );
						( ui as any ).notifications?.error( 'Could not open item details.' );
					}
				}
				else 
				{
					console.error( `yugen-merchant | item at index ${ item_index } not found in inventory` );
				}
			}
		}
		catch ( err ) 
		{
			console.error( 'yugen-merchant | show-sheet error:', err );
		}
	}

	/** management handlers **/

	static async _on_toggle_merchant( this: MerchantShop, event: any, target: HTMLInputElement ) 
	{
		const next = target.checked;
		const doc = this.token.document;
		if ( next ) 
		{
			await MerchantManager.initialize_merchant( doc );
		}
		else 
		{
			await set_flag( doc, FLAGS.IS_MERCHANT, false );
		}
		this.render( );
	}

	static async _on_toggle_infinite( this: MerchantShop, event: any, target: HTMLInputElement ) 
	{
		await set_flag( this.token.document, FLAGS.INFINITE_FUNDS, target.checked );
	}

	static async _on_update_multiplier( this: MerchantShop, event: any, target: HTMLInputElement ) 
	{
		const val = parseFloat( target.value ) / 100;
		const flag = target.classList.contains( 'buy-multiplier' ) ? FLAGS.BUY_MULTIPLIER : 
		             target.classList.contains( 'sell-multiplier' ) ? FLAGS.SELL_MULTIPLIER : null;
		
		if ( flag ) 
		{
			await set_flag( this.token.document, flag, val, { render: false } );
		}
		else if ( target.classList.contains( 'rarity-multiplier' ) ) 
		{
			const rarity = target.getAttribute( 'data-rarity' );
			const current = get_flag( this.token.document, FLAGS.QUALITY_MULTIPLIERS ) ?? { };
			current[ rarity! ] = val;
			await set_flag( this.token.document, FLAGS.QUALITY_MULTIPLIERS, current, { render: false } );
		}
	}

	static async _on_randomize_rarities( this: MerchantShop, event: any ) 
	{
		const next = MerchantManager.get_default_quality_multipliers( );
		await set_flag( this.token.document, FLAGS.QUALITY_MULTIPLIERS, next );
		this.render( );
	}

	static _on_add_service( this: MerchantShop, event: any ) 
	{
		new MerchantServiceEditor( this.token.document, -1, { }, ( ) => this.render( ) ).render( true );
	}

	static _on_edit_service( this: MerchantShop, event: any, target: HTMLElement ) 
	{
		const index = parseInt( target.closest( '.inventory-item' )?.getAttribute( 'data-index' ) || '-1' );
		if ( index !== -1 ) 
		{
			new MerchantServiceEditor( this.token.document, index, { }, ( ) => this.render( ) ).render( true );
		}
	}

	static async _on_delete_service( this: MerchantShop, event: any, target: HTMLElement ) 
	{
		const index = parseInt( target.closest( '.inventory-item' )?.getAttribute( 'data-index' ) || '-1' );
		if ( index !== -1 ) 
		{
			const services = get_flag( this.token.document, FLAGS.SERVICES ) ?? [ ];
			services.splice( index, 1 );
			await set_flag( this.token.document, FLAGS.SERVICES, services );
			this.render( );
		}
	}

	static _on_edit_item( this: MerchantShop, event: any, target: HTMLElement ) 
	{
		const index = parseInt( target.closest( '.inventory-item' )?.getAttribute( 'data-index' ) || '-1' );
		if ( index !== -1 ) 
		{
			new MerchantItemEditor( this.token.document, index, { }, ( ) => this.render( ) ).render( true );
		}
	}

	static async _on_delete_item( this: MerchantShop, event: any, target: HTMLElement ) 
	{
		const index = parseInt( target.closest( '.inventory-item' )?.getAttribute( 'data-index' ) || '-1' );
		if ( index !== -1 ) 
		{
			const inventory = get_flag( this.token.document, FLAGS.INVENTORY ) ?? [ ];
			inventory.splice( index, 1 );
			await set_flag( this.token.document, FLAGS.INVENTORY, inventory );
			this.render( );
		}
	}
}
