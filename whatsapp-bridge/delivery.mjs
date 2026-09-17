// Persist before sending. Uncertain attempts are reported, never retried blindly.
export async function deliver(job,{client,journal,report,ready}){
 let saved=journal.get(job.id);
 if(saved?.status==='started'||(!saved&&job.resumed)){
  saved={id:job.id,leaseToken:job.leaseToken,status:'uncertain',messageId:''};journal.put(job.id,saved);
 }
 if(saved){await report(saved);return}
 let chat;
 try{if(!ready())throw Error('Not ready');chat=await client.getNumberId(job.phone);if(!chat?._serialized)throw Error('Recipient not found')}
 catch{const result={id:job.id,leaseToken:job.leaseToken,status:'failed',messageId:''};journal.put(job.id,result);await report(result);return}
 if(!ready()){const result={id:job.id,leaseToken:job.leaseToken,status:'failed',messageId:''};journal.put(job.id,result);await report(result);return}
 journal.put(job.id,{id:job.id,leaseToken:job.leaseToken,status:'started',messageId:''});
 let result;
 try{
  const message=await client.sendMessage(chat._serialized,job.text,{sendSeen:false,waitUntilMsgSent:true});
  const messageId=message?.id?._serialized;if(!messageId)throw Error('No message id');
  result={id:job.id,leaseToken:job.leaseToken,status:'sent',messageId};
 }catch{result={id:job.id,leaseToken:job.leaseToken,status:'uncertain',messageId:''}}
 journal.put(job.id,result);await report(result);
}
