/**
 * @file src/module/merchant-manager.ts
 * logic for managing token-level merchant state
 **/

import { FLAGS, MODULE_ID } from './constants.js';
import { get_flag, set_flag } from './utils.js';

export class MerchantManager 
{
	/**
	 * initializes a token as a merchant with default settings
	 **/
	static async initialize_merchant( token_doc: any ): Promise<void> 
	{
		const doc = token_doc.document || token_doc;

		/** initialization usually happens during manual toggle, so we allow render **/
		await set_flag( doc, FLAGS.IS_MERCHANT, true );

		if ( get_flag( doc, FLAGS.BUY_MULTIPLIER ) === undefined ) 
		{
			await set_flag( doc, FLAGS.BUY_MULTIPLIER, 1.0 );
		}

		if ( get_flag( doc, FLAGS.SELL_MULTIPLIER ) === undefined ) 
		{
			await set_flag( doc, FLAGS.SELL_MULTIPLIER, 0.5 );
		}

		if ( get_flag( doc, FLAGS.INVENTORY ) === undefined ) 
		{
			await set_flag( doc, FLAGS.INVENTORY, [ ] );
		}

		if ( get_flag( doc, FLAGS.QUALITY_MULTIPLIERS ) === undefined ) 
		{
			await set_flag( doc, FLAGS.QUALITY_MULTIPLIERS, this.get_default_quality_multipliers( ) );
		}

		if ( get_flag( doc, FLAGS.INTERACTION_RANGE ) === undefined ) 
		{
			await set_flag( doc, FLAGS.INTERACTION_RANGE, 10 );
		}
	}

	/**
	 * adds an item to a token's virtual inventory
	 **/
	static async add_to_inventory( token_doc: any, item_data: any ): Promise<void> 
	{
		const doc = token_doc.document || token_doc;
		const inventory = get_flag( doc, FLAGS.INVENTORY ) ?? [ ];
		
		/** handle automatic spell scroll conversion for D&D 5e **/
		let final_item_data = ( foundry.utils as any ).duplicate( item_data );
		if ( final_item_data.type === 'spell' && ( game as any ).system.id === 'dnd5e' ) 
		{
			try 
			{
				/** 
				 * leverage dnd5e system native scroll creation.
				 * we create a temporary item to use the system helper.
				 **/
				const spell_item = await ( Item as any ).create( final_item_data, { temporary: true } );
				const scroll_item = await ( game as any ).dnd5e.documents.Item5e.createScrollFromSpell( spell_item );
				if ( scroll_item ) 
				{
					final_item_data = scroll_item.toObject( );
					
					/** only log if debug mode is enabled **/
					if ( ( game as any ).settings.get( MODULE_ID, 'debug-mode' ) ) 
					{
						console.log( `${ MODULE_ID } | converted spell ${ spell_item.name } to scroll` );
					}
				}
			}
			catch ( err ) 
			{
				console.error( `${ MODULE_ID } | scroll conversion error:`, err );
			}
		}

		/** handle incoming item quantity (default to 1 if not present) **/
		const incoming_qty = final_item_data.system?.quantity || 1;

		const existing = inventory.find( ( i: any ) => i.name === final_item_data.name && i.type === final_item_data.type );
		
		if ( existing ) 
		{
			/** just add the specific quantity of the dropped item to the existing stack **/
			existing.system.quantity = ( existing.system.quantity || 0 ) + incoming_qty;
		}
		else 
		{
			const item_obj = final_item_data;
			
			/** handle optional stock randomization only for brand new items **/
			const randomize = ( game as any ).settings.get( MODULE_ID, 'randomize-quantity' );
			if ( randomize ) 
			{
				item_obj.system.quantity = Math.floor( Math.random( ) * 10 ) + 1;
			}
			else 
			{
				/** keep the quantity from the dropped item or default to 1 **/
				item_obj.system.quantity = incoming_qty;
			}

			inventory.push( item_obj );
		}

		/** use render: false to prevent flinging user away from tab **/
		await set_flag( doc, FLAGS.INVENTORY, inventory, { render: false } );
	}

	/**
	 * generates a random multiplier within a range
	 **/
	public static get_random_multiplier( min: number, max: number ): number 
	{
		const val = Math.random( ) * ( max - min ) + min;
		return Math.round( val * 100 ) / 100;
	}

	/**
	 * returns the default set of randomized rarity multipliers
	 **/
	public static get_default_quality_multipliers( ): any 
	{
		return {
			common: this.get_random_multiplier( 0.9, 1.1 ),
			uncommon: this.get_random_multiplier( 0.8, 1.2 ),
			rare: this.get_random_multiplier( 0.7, 1.5 ),
			veryrare: this.get_random_multiplier( 0.6, 2.0 ),
			legendary: this.get_random_multiplier( 0.5, 3.0 ),
			artifact: this.get_random_multiplier( 1.0, 5.0 )
		};
	}
}
