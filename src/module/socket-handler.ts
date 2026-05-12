/**
 * @file src/module/socket-handler.ts
 * handles cross-client communication for transactions
 **/

import { FLAGS } from './constants.js';
import { calculate_price, get_flag, set_flag, get_actor_currency } from './utils.js';

export class SocketHandler 
{
	/**
	 * registers socket listeners for the module
	 **/
	static register( ): void 
	{
		const socket_name = 'module.yugen-merchant';

		if ( !( game as any ).socket ) 
		{
			return;
		}

		console.log( `yugen-merchant | registering socket: ${ socket_name }` );
		
		( game as any ).socket.on( socket_name, ( data: any ) => 
		{
			const is_gm = ( game as any ).user.isGM;
			console.log( `yugen-merchant | socket message received | isGM: ${ is_gm }`, data );

			if ( data.action === 'purchase' && is_gm ) 
			{
				this.handle_purchase( data ).catch( err => console.error( 'yugen-merchant | purchase error:', err ) );
			}
			else if ( data.action === 'sale' && is_gm ) 
			{
				this.handle_sale( data ).catch( err => console.error( 'yugen-merchant | sale error:', err ) );
			}
			else if ( data.action === 'purchase_service' && is_gm ) 
			{
				this.handle_purchase_service( data ).catch( err => console.error( 'yugen-merchant | service purchase error:', err ) );
			}
			else if ( data.action === 'service_approved' ) 
			{
				this.handle_service_approved( data );
			}
		} );
	}

	/**
	 * helper to resolve an actor from an ID (supports world actors and synthetic tokens)
	 **/
	private static _resolve_actor( id: string ): any 
	{
		return ( game as any ).actors.get( id ) || 
		       ( canvas as any ).tokens?.get( id )?.actor || 
		       ( canvas as any ).tokens?.placeables.find( ( t: any ) => t.id === id )?.actor;
	}

	/**
	 * handles a purchase request (executed only on GM client)
	 **/
	private static async handle_purchase( data: any ): Promise<void> 
	{
		const token = ( canvas as any ).tokens?.get( data.token_id ) || ( canvas as any ).tokens?.placeables.find( ( t: any ) => t.id === data.token_id );
		const player_actor = this._resolve_actor( data.player_id );
		
		if ( !token || !player_actor ) 
		{
			console.error( 'yugen-merchant | purchase error: could not resolve context', data );
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
		const player_funds_obj = get_actor_currency( player_actor );
		const player_funds = player_funds_obj[ denom ] || 0;

		if ( player_funds < cost ) 
		{
			ui.notifications?.error( `Insufficient ${ denom }.` );
			return;
		}

		const update_path = player_actor.system?.resources?.coinage ? 'system.resources.coinage' : 'system.currency';
		await player_actor.update( { [`${ update_path }.${ denom }`]: player_funds - cost } );
		
		const existing_player_item = player_actor.items.find( ( i: any ) => i.name === item_data.name && i.type === item_data.type );
		if ( existing_player_item ) 
		{
			const new_qty = ( existing_player_item.system.quantity || 1 ) + 1;
			await existing_player_item.update( { 'system.quantity': new_qty } );
		}
		else 
		{
			const new_item_data = ( foundry.utils as any ).duplicate( item_data );
			new_item_data.system.quantity = 1;
			await player_actor.createEmbeddedDocuments( 'Item', [ new_item_data ] );
		}

		const merchant_actor = token.actor;
		if ( merchant_actor ) 
		{
			const merchant_funds_obj = get_actor_currency( merchant_actor );
			const merchant_funds = merchant_funds_obj[ denom ] || 0;
			const merchant_update_path = merchant_actor.system?.resources?.coinage ? 'system.resources.coinage' : 'system.currency';
			await merchant_actor.update( { [`${ merchant_update_path }.${ denom }`]: merchant_funds + cost } );
		}

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
		const token = ( canvas as any ).tokens?.get( data.token_id ) || ( canvas as any ).tokens?.placeables.find( ( t: any ) => t.id === data.token_id );
		const player_actor = this._resolve_actor( data.player_id );
		const item = player_actor?.items.get( data.item_id );
		
		if ( !token || !player_actor || !item ) 
		{
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
		
		const merchant_actor = token.actor;
		const merchant_funds_obj = get_actor_currency( merchant_actor );
		const merchant_funds = merchant_funds_obj[ denom ] || 0;
		const is_infinite = get_flag( token.document, FLAGS.INFINITE_FUNDS ) ?? false;
		
		if ( !is_infinite && merchant_funds < price ) 
		{
			ui.notifications?.error( `${ merchant_actor?.name || 'The merchant' } does not have enough ${ denom }.` );
			return;
		}

		const player_update_path = player_actor.system?.resources?.coinage ? 'system.resources.coinage' : 'system.currency';
		await player_actor.update( { [`${ player_update_path }.${ denom }`]: player_funds + price } );
		
		if ( merchant_actor && !is_infinite ) 
		{
			const merchant_update_path = merchant_actor.system?.resources?.coinage ? 'system.resources.coinage' : 'system.currency';
			await merchant_actor.update( { [`${ merchant_update_path }.${ denom }`]: merchant_funds - price } );
		}
		
		const inventory = get_flag( token.document, FLAGS.INVENTORY ) ?? [ ];
		const existing = inventory.find( ( i: any ) => i.name === item.name && i.type === item.type );
		
		if ( existing ) 
		{
			existing.system.quantity = ( existing.system.quantity || 1 ) + 1;
		}
		else 
		{
			const item_data = item.toObject( );
			item_data.system.quantity = 1;
			inventory.push( item_data );
		}

		await set_flag( token.document, FLAGS.INVENTORY, inventory, { render: false } );

		if ( item.system.quantity > 1 ) 
		{
			await item.update( { 'system.quantity': item.system.quantity - 1 } );
		}
		else 
		{
			await player_actor.deleteEmbeddedDocuments( 'Item', [ item.id ] );
		}

		ui.notifications?.info( `${ player_actor.name } sold ${ item.name } for ${ price } ${ denom }.` );
	}

	/**
	 * handles a service purchase request (executed only on GM client)
	 **/
	private static async handle_purchase_service( data: any ): Promise<void> 
	{
		const token = ( canvas as any ).tokens?.get( data.token_id ) || ( canvas as any ).tokens?.placeables.find( ( t: any ) => t.id === data.token_id );
		const player_actor = this._resolve_actor( data.player_id );
		
		if ( !token || !player_actor ) 
		{
			return;
		}

		const services = get_flag( token.document, FLAGS.SERVICES ) ?? [ ];
		const service = services[ data.service_index ];
		if ( !service ) 
		{
			return;
		}

		const cost = service.price || 0;
		const player_funds_obj = get_actor_currency( player_actor );
		const player_funds = player_funds_obj.gp || 0;

		if ( player_funds < cost ) 
		{
			ui.notifications?.error( 'Insufficient gp.' );
			return;
		}

		const update_path = player_actor.system?.resources?.coinage ? 'system.resources.coinage' : 'system.currency';
		await player_actor.update( { [`${ update_path }.gp`]: player_funds - cost } );

		const merchant_actor = token.actor;
		if ( merchant_actor ) 
		{
			const merchant_funds_obj = get_actor_currency( merchant_actor );
			const merchant_funds = merchant_funds_obj.gp || 0;
			const merchant_update_path = merchant_actor.system?.resources?.coinage ? 'system.resources.coinage' : 'system.currency';
			await merchant_actor.update( { [`${ merchant_update_path }.gp`]: merchant_funds + cost } );
		}

		ui.notifications?.info( `${ player_actor.name } purchased ${ service.name } for ${ cost } gp.` );
		
		( game as any ).socket.emit( 'module.yugen-merchant', {
			action: 'service_approved',
			buyer_user_id: data.buyer_user_id,
			service_name: service.name,
			macro_id: service.macro_id
		} );

		if ( data.buyer_user_id === ( game as any ).user.id ) 
		{
			this.handle_service_approved( { 
				macro_id: service.macro_id, 
				buyer_user_id: data.buyer_user_id,
				service_name: service.name 
			} );
		}
	}

	/**
	 * executes the service macro on the buyer's client
	 **/
	private static handle_service_approved( data: any ): void 
	{
		if ( ( game as any ).user.id !== data.buyer_user_id ) 
		{
			return;
		}

		if ( !data.macro_id ) 
		{
			return;
		}

		const macro = ( game as any ).macros.get( data.macro_id );
		if ( macro ) 
		{
			ui.notifications?.info( `Activating service: ${ data.service_name }...` );
			macro.execute( );
		}
	}

	static async emit_purchase( token_id: string, player_id: string, item_index: number ): Promise<void> 
	{
		const data = { action: 'purchase', token_id, player_id, item_index };
		console.log( 'yugen-merchant | emitting purchase request', data );

		if ( ( game as any ).user.isGM ) 
		{
			await this.handle_purchase( data );
		}
		else 
		{
			( game as any ).socket.emit( 'module.yugen-merchant', data );
		}
	}

	static async emit_sale( token_id: string, player_id: string, item_id: string ): Promise<void> 
	{
		const data = { action: 'sale', token_id, player_id, item_id };
		console.log( 'yugen-merchant | emitting sale request', data );

		if ( ( game as any ).user.isGM ) 
		{
			await this.handle_sale( data );
		}
		else 
		{
			( game as any ).socket.emit( 'module.yugen-merchant', data );
		}
	}

	static async emit_purchase_service( token_id: string, player_id: string, service_index: number, buyer_user_id: string ): Promise<void> 
	{
		const data = { action: 'purchase_service', token_id, player_id, service_index, buyer_user_id };
		console.log( 'yugen-merchant | emitting service purchase', data );

		if ( ( game as any ).user.isGM ) 
		{
			await this.handle_purchase_service( data );
		}
		else 
		{
			( game as any ).socket.emit( 'module.yugen-merchant', data );
		}
	}
}
