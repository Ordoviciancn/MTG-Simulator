import type { Command, CommandReceipt } from './matchProtocol';
import type { ForgePrompt } from './forgeTypes';

export type ArenaCard = {id:string;name:string;ownerId:string;controllerId:string;kind:string;tapped:boolean;hidden:boolean;actionable:boolean;power?:number;toughness?:number;stackId?:string;ability?:boolean};
export type ArenaPlayer = {id:string;name:string;life:number;libraryCount:number;handCount:number;hand:ArenaCard[];battlefield:ArenaCard[];graveyard:ArenaCard[];exile:ArenaCard[]};
export type ArenaSnapshot = {players:ArenaPlayer[];stack:ArenaCard[];phase:string;activePlayerId:string|null;gameOver:boolean;lastEventSequence:number};
export type ArenaEvent = {sequence:number;kind:string;data:{playerId?:string;cardId?:string;name?:string;from?:string;to?:string;before?:number;after?:number;tapped?:boolean;fizzled?:boolean}};
export type ArenaRoomView = {matchId:string;code:string;playerId:string;seat:number;revision:number;status:'waiting'|'starting'|'playing'|'failed';snapshot:ArenaSnapshot|null;prompt:ForgePrompt|null;fullControl:boolean;error?:string};
export type ArenaCredential = {code:string;playerId:string;token:string};
export type ArenaClientMessage =
 | {type:'create';name:string;deckText:string}
 | {type:'join';code:string;name:string;deckText:string}
 | {type:'resume';credential:ArenaCredential}
 | {type:'command';command:Command}
 | {type:'resync'};
export type ArenaServerMessage =
 | {type:'credential';credential:ArenaCredential}
 | {type:'view';room:ArenaRoomView}
 | {type:'event';matchId:string;event:ArenaEvent}
 | {type:'receipt';receipt:CommandReceipt}
 | {type:'error';message:string};
