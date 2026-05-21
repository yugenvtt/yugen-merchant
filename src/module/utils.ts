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
	/** retrieve flag from document via shared library **/
	return ( globalThis as any ).yugen_utils.get_flag( doc, MODULE_ID, key );
};

/**
 * sets a namespaced flag on a document
 **/
export const set_flag = async ( doc: any, key: string, value: any, options: any = { } ): Promise<any> => 
{
	/** set flag on document via shared library **/
	return await ( globalThis as any ).yugen_utils.set_flag( doc, MODULE_ID, key, value, options );
};

/**
 * gets the currency object from an actor in a system-agnostic way
 **/
export const get_actor_currency = ( actor: any ): any => 
{
	/** retrieve currency object via shared library **/
	return ( globalThis as any ).yugen_utils.get_actor_currency( actor );
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
