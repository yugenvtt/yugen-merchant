/**
 * @file src/module/socket-handler.ts
 * handles cross-client communication for transactions
 **/

import { MODULE_ID, FLAGS } from './constants.js';
import { calculate_price, get_flag, set_flag, get_actor_currency } from './utils.js';

export class SocketHandler 
{
	/**
	 * registers socket listeners for the module
	 **/
	static register( ): void 
	{
		( game as any ).socket.on( `module.${ MODULE_ID }`, ( data: any ) => 
		{
			/** only log if debug mode is enabled **/
			if ( ( game as any ).settings.get( MODULE_ID, 'debug-mode' ) ) 
			{
				console.log( `${ MODULE_ID } | socket received:`, data );
			}

			if ( data.action === 'purchase' ) 
			{
				this.handle_purchase( data );
			}
			else if ( data.action === 'sale' ) 
			{
				this.handle_sale( data );
			}
		} );
	}

	/**
	 * handles a purchase request (executed only on GM client)
	 **/
	private static async handle_purchase( data: any ): Promise<void> 
	{
		if ( !( game as any ).user.isGM ) 
		{
			return;
		}

		const token = ( canvas as any ).tokens?.get( data.token_id ) || ( canvas as any ).tokens?.placeables.find( ( t: any ) => t.id === data.token_id );
		const player_actor = ( game as any ).actors.get( data.player_id );
		if ( !token || !player_actor ) 
		{
			/** abort if token or actor cannot be resolved **/
			return;
		}

		const inventory = get_flag( token.document, FLAGS.INVENTORY ) ?? [ ];
		const item_data = inventory[ data.item_index ];
		if ( !item_data ) 
		{
			return;
		}

		const cost = calculate_price( 
			item_data.system?.price?.value || 0, 
			item_data.system?.rarity || 'common', 
			token.document, 
			true 
		);
		
		const denom = item_data.system?.price?.denomination || 'gp';
		/** fetch actor currency in a system-agnostic way **/
		const player_funds_obj = get_actor_currency( player_actor );
		const player_funds = player_funds_obj[ denom ] || 0;
		
		if ( player_funds < cost ) 
		{
			/** send warning for insufficient funds **/
			ui.notifications?.error( `Insufficient ${ denom }.` );
			return;
		}

		/** resolve the correct system path for currency updates **/
		const update_path = player_actor.system?.resources?.coinage ? 'system.resources.coinage' : 'system.currency';
		
		/** execute currency deduction using resolved system path **/
		await player_actor.update( { [`${ update_path }.${ denom }`]: player_funds - cost } );
		
		/** 
		 * smart stacking: check if player already has this item.
		 * we look for items of the same name and type.
		 **/
		const existing_player_item = player_actor.items.find( ( i: any ) => i.name === item_data.name && i.type === item_data.type );
		if ( existing_player_item ) 
		{
			/** increment quantity of existing item stack **/
			const new_qty = ( existing_player_item.system.quantity || 1 ) + 1;
			await existing_player_item.update( { 'system.quantity': new_qty } );
		}
		else 
		{
			/** add a new item stack to player embedded documents **/
			const new_item_data = ( foundry.utils as any ).duplicate( item_data );
			new_item_data.system.quantity = 1;
			await player_actor.createEmbeddedDocuments( 'Item', [ new_item_data ] );
		}

		/** add funds to the merchant actor **/
		const merchant_actor = token.actor;
		if ( merchant_actor ) 
		{
			const merchant_funds_obj = get_actor_currency( merchant_actor );
			const merchant_funds = merchant_funds_obj[ denom ] || 0;
			const merchant_update_path = merchant_actor.system?.resources?.coinage ? 'system.resources.coinage' : 'system.currency';
			
			/** update merchant actor coinage with the transaction cost **/
			await merchant_actor.update( { [`${ merchant_update_path }.${ denom }`]: merchant_funds + cost } );
		}

		/** update token inventory quantity **/
		if ( item_data.system.quantity > 1 ) 
		{
			item_data.system.quantity -= 1;
		}
		else 
		{
			inventory.splice( data.item_index, 1 );
		}

		await set_flag( token.document, FLAGS.INVENTORY, inventory, { render: false } );
		ui.notifications?.info( `${ player_actor.name } purchased ${ item_data.name } for ${ cost } ${ denom }.` );
	}

	/**
	 * handles a sale request (executed only on GM client)
	 **/
	private static async handle_sale( data: any ): Promise<void> 
	{
		if ( !( game as any ).user.isGM ) 
		{
			return;
		}

		const token = ( canvas as any ).tokens?.get( data.token_id ) || ( canvas as any ).tokens?.placeables.find( ( t: any ) => t.id === data.token_id );
		const player_actor = ( game as any ).actors.get( data.player_id );
		const item = player_actor?.items.get( data.item_id );
		
		if ( !token || !player_actor || !item ) 
		{
			/** abort if sale context is incomplete **/
			return;
		}

		const price = calculate_price( 
			item.system?.price?.value || 0, 
			item.system?.rarity || 'common', 
			token.document, 
			false 
		);
		
		const denom = item.system?.price?.denomination || 'gp';
		const player_funds_obj = get_actor_currency( player_actor );
		const player_funds = player_funds_obj[ denom ] || 0;
		
		/** verify merchant actor has enough funds to buy the item **/
		const merchant_actor = token.actor;
		const merchant_funds_obj = get_actor_currency( merchant_actor );
		const merchant_funds = merchant_funds_obj[ denom ] || 0;
		const is_infinite = get_flag( token.document, FLAGS.INFINITE_FUNDS ) ?? false;
		
		if ( !is_infinite && merchant_funds < price ) 
		{
			/** abort if merchant cannot afford the item and infinite funds is disabled **/
			ui.notifications?.error( `${ merchant_actor?.name || 'The merchant' } does not have enough ${ denom }.` );
			return;
		}

		/** resolve the correct system path for currency updates **/
		const player_update_path = player_actor.system?.resources?.coinage ? 'system.resources.coinage' : 'system.currency';

		/** pay the player using resolved system path **/
		await player_actor.update( { [`${ player_update_path }.${ denom }`]: player_funds + price } );
		
		/** deduct funds from the merchant actor if not infinite **/
		if ( merchant_actor && !is_infinite ) 
		{
			const merchant_update_path = merchant_actor.system?.resources?.coinage ? 'system.resources.coinage' : 'system.currency';
			/** update merchant actor coinage by deducting the price **/
			await merchant_actor.update( { [`${ merchant_update_path }.${ denom }`]: merchant_funds - price } );
		}
		
		/** add item to merchant virtual inventory flag **/
		const inventory = get_flag( token.document, FLAGS.INVENTORY ) ?? [ ];
		const existing = inventory.find( ( i: any ) => i.name === item.name && i.type === item.type );
		
		if ( existing ) 
		{
			existing.system.quantity = ( existing.system.quantity || 1 ) + 1;
		}
		else 
		{
			/** convert item document to plain object for storage **/
			const item_data = item.toObject( );
			item_data.system.quantity = 1;
			inventory.push( item_data );
		}

		/** update the virtual inventory flag on the token **/
		await set_flag( token.document, FLAGS.INVENTORY, inventory, { render: false } );

		/** remove item from player using embedded document deletion **/
		if ( item.system.quantity > 1 ) 
		{
			/** decrement quantity if multiple items exist **/
			await item.update( { 'system.quantity': item.system.quantity - 1 } );
		}
		else 
		{
			/** delete the item document if quantity is 1 **/
			await player_actor.deleteEmbeddedDocuments( 'Item', [ item.id ] );
		}

		/** notify players of the successful sale **/
		ui.notifications?.info( `${ player_actor.name } sold ${ item.name } for ${ price } ${ denom }.` );
	}

	static async emit_purchase( token_id: string, player_id: string, item_index: number ): Promise<void> 
	{
		const data = 
		{
			action: 'purchase',
			token_id,
			player_id,
			item_index
		};

		/** gms process their own transactions locally to avoid socket isolation **/
		if ( ( game as any ).user.isGM ) 
		{
			/** only log if debug mode is enabled **/
			if ( ( game as any ).settings.get( MODULE_ID, 'debug-mode' ) ) 
			{
				console.log( `${ MODULE_ID } | gm purchasing locally` );
			}
			await this.handle_purchase( data );
		}
		else 
		{
			/** emit to gm clients for processing **/
			( game as any ).socket.emit( `module.${ MODULE_ID }`, data );
		}
	}

	static async emit_sale( token_id: string, player_id: string, item_id: string ): Promise<void> 
	{
		const data = 
		{
			action: 'sale',
			token_id,
			player_id,
			item_id
		};

		/** gms process their own transactions locally to avoid socket isolation **/
		if ( ( game as any ).user.isGM ) 
		{
			/** only log if debug mode is enabled **/
			if ( ( game as any ).settings.get( MODULE_ID, 'debug-mode' ) ) 
			{
				console.log( `${ MODULE_ID } | gm selling locally` );
			}
			await this.handle_sale( data );
		}
		else 
		{
			/** emit to gm clients for processing **/
			( game as any ).socket.emit( `module.${ MODULE_ID }`, data );
		}
	}
}
