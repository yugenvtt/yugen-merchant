/**
 * @file src/module/utils.ts
 * utility functions for merchant logic and data handling
 **/

import { MODULE_ID, FLAGS } from './constants.js';

/**
 * retrieves a namespaced flag from a document
 **/
export const get_flag = ( doc: any, key: string ): any => 
{
	const document = doc.document || doc;
	return document.getFlag( MODULE_ID, key );
};

/**
 * sets a namespaced flag on a document
 **/
export const set_flag = async ( doc: any, key: string, value: any, options: any = { } ): Promise<any> => 
{
	const document = doc.document || doc;
	/** allow passing render: false to prevent full application refreshes **/
	return await document.setFlag( MODULE_ID, key, value, options );
};

/**
 * gets the currency object from an actor in a system-agnostic way
 **/
export const get_actor_currency = ( actor: any ): any => 
{
	if ( !actor ) 
	{
		return { cp: 0, sp: 0, gp: 0, pp: 0 };
	}

	/** pf2e uses system.resources.coinage **/
	const pf2e_currency = actor.system?.resources?.coinage;
	if ( pf2e_currency ) 
	{
		return pf2e_currency;
	}

	/** dnd5e uses system.currency **/
	const dnd5e_currency = actor.system?.currency;
	if ( dnd5e_currency ) 
	{
		console.log( `yugen-merchant | resolved dnd5e currency for ${ actor.name }:`, dnd5e_currency );
		return dnd5e_currency;
	}

	console.warn( `yugen-merchant | could not resolve currency for ${ actor.name }` );
	return { cp: 0, sp: 0, gp: 0, pp: 0 };
};

/**
 * calculates the final price based on multipliers
 **/
export const calculate_price = ( base_price: number, quality: string, merchant_doc: any, is_buying: boolean ): number => 
{
	const buy_mult = get_flag( merchant_doc, FLAGS.BUY_MULTIPLIER ) ?? 1.0;
	const sell_mult = get_flag( merchant_doc, FLAGS.SELL_MULTIPLIER ) ?? 0.5;
	const quality_mults = get_flag( merchant_doc, FLAGS.QUALITY_MULTIPLIERS ) ?? { };
	
	const quality_mult = quality_mults[ quality.toLowerCase( ) ] ?? 1.0;
	const transaction_mult = is_buying ? buy_mult : sell_mult;
	
	const final = base_price * quality_mult * transaction_mult;

	/** only log if debug mode is enabled **/
	if ( ( game as any ).settings.get( MODULE_ID, 'debug-mode' ) ) 
	{
		console.log( `${ MODULE_ID } | price calc: base=${ base_price }, qual_mult=${ quality_mult }, trans_mult=${ transaction_mult }, final=${ final }` );
	}

	return Math.round( final );
};
