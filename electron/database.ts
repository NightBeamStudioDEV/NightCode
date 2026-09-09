import initSqlJs from 'sql.js';
import {Worker} from 'node:worker_threads';
export type DatabaseRequest={bytes:Uint8Array;sql:string;params:(string|number|null)[];write:boolean;wasm:string};
export async function queryDatabase(p:DatabaseRequest){
  const SQL=await initSqlJs({locateFile:()=>p.wasm}),db=new SQL.Database(p.bytes);
  try{
    if(!p.write)db.run('PRAGMA query_only=ON');
    const results:any[]=[];let count=0;
    for(const statement of db.iterateStatements(p.sql)){
      if(++count>10)throw new Error('Use at most 10 SQL statements per call');
      if(!p.write&&!/^\s*(SELECT|WITH|EXPLAIN)\b/i.test(statement.getSQL()))throw new Error('Read queries must start with SELECT, WITH, or EXPLAIN');
      statement.bind(p.params);const columns=statement.getColumnNames(),values:any[]=[];let truncated=false;
      while(statement.step()){if(values.length>=200){truncated=true;break;}values.push(statement.get().map(v=>typeof v==='string'?v.slice(0,4000):v instanceof Uint8Array?'[binary data]':v));}
      if(columns.length)results.push({columns,values,truncated});
    }
    return {results,bytes:p.write?db.export():undefined};
  }finally{db.close();}
}
export function databaseInWorker(workerFile:string,p:DatabaseRequest,alive:()=>boolean,timeoutMs=10000){
  return new Promise<Awaited<ReturnType<typeof queryDatabase>>>((resolve,reject)=>{
    const worker=new Worker(workerFile,{workerData:p,resourceLimits:{maxOldGenerationSizeMb:128}});let settled=false;
    const finish=(error?:Error,result?:any)=>{if(settled)return;settled=true;clearTimeout(timer);clearInterval(cancel);void worker.terminate();error?reject(error):resolve(result);};
    const timer=setTimeout(()=>finish(new Error('Database query exceeded 10 seconds')),timeoutMs);
    const cancel=setInterval(()=>{if(!alive())finish(new Error('Task stopped'));},100);
    worker.on('message',message=>message.error?finish(new Error(message.error)):finish(undefined,message));
    worker.on('error',error=>finish(error));worker.on('exit',code=>{if(!settled)finish(new Error('Database worker stopped: '+code));});
  });
}
