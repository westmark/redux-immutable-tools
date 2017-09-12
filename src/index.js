import {
  Record,
  List,
  Set as ImmutableSet,
  fromJS as immutableFromJS,
} from 'immutable';

export function ListOfComposer( recordType ) {
  this.recordType = recordType;
}

export const listOf = ( recordType ) => new ListOfComposer( recordType );

export function recordFromJs( MyRecord, values ) {
  if ( values === null ) {
    return null;
  }
  const data = {};
  const newRecord = new MyRecord();
  Object.keys( values ).forEach( ( key ) => {
    const value = values[ key ];
    const prop = newRecord.constructor.prototype[ key ];
    if ( prop ) {
      if ( Array.isArray( value ) ) {
        if ( prop === List ) {
          data[ key ] = new List( value );
        } else if ( prop === ImmutableSet ) {
          data[ key ] = new ImmutableSet( value );
        } else if ( prop.constructor === ListOfComposer ) {
          data[ key ] = new List( value.map( ( v ) => recordFromJs( prop.recordType, v ) ) );
        } else if ( prop.constructor === Record.constructor ) {
          data[ key ] = recordFromJs( prop, value );
        } else {
          data[ key ] = value;
        }
      } else if ( typeof values[ key ] === 'object' ) {
        if ( prop.constructor === Record.constructor ) {
          data[ key ] = recordFromJs( prop, value );
        } else {
          data[ key ] = immutableFromJS( value );
        }
      } else {
        data[ key ] = immutableFromJS( value );
      }
    } else {
      data[ key ] = immutableFromJS( value );
    }
  } );

  return new MyRecord( data );
}

function merge( prev, next ) {
  return next === undefined ? prev : next;
}

function pick( record, keys ) {
  const obj = {};
  keys.forEach( ( key ) => { obj[ key ] = record.get( key ); } );
  return obj;
}

export function updateOrMerge( state, containerPath, RecordType, values = {}, { replace = false } = {} ) {
  let primaryKey = 'id';

  if ( RecordType.primaryKey ) {
    primaryKey = RecordType.primaryKey;
  }
  const id = values[ primaryKey ];

  const existingIndex = state.getIn( containerPath ).findIndex( ( o ) => o.get( primaryKey ) === id );
  const newEntry = recordFromJs( RecordType, values );

  if ( existingIndex >= 0 ) {
    const existing = state.getIn( containerPath ).get( existingIndex );
    let legalKeys = newEntry.keySeq().toArray().filter( ( key ) => Reflect.has( values, key ) );
    // Check for listComposers and handle them separately
    const listComposerKeys = [];
    legalKeys = legalKeys.filter( ( key ) => {
      if ( existing.constructor.prototype[ key ] && existing.constructor.prototype[ key ].constructor === ListOfComposer ) {
        listComposerKeys.push( key );
        return false;
      }
      return true;
    } );
    let merged = newEntry;
    if ( !replace ) {
      merged = existing.mergeWith( merge, pick( merged, legalKeys ) );
    }
    // Now overwrite the lists
    listComposerKeys.forEach( ( key ) => {
      merged = merged.set( key, newEntry.get( key ) );
    } );
    return state.setIn( [ ...containerPath, existingIndex ], merged );
  }

  const newSubState = state.getIn( containerPath ).push( newEntry );
  return state.setIn( containerPath, newSubState );
}

export function boolify( obj ) {
  const ret = {};
  Object.keys( obj ).forEach( ( key ) => {
    if ( obj[ key ] === false || obj[ key ] === true ) {
      ret[ key ] = obj[ key ];
    }
  } );

  return ret;
}
