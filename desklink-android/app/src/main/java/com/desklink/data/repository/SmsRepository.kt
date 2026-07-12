package com.desklink.data.repository

import android.content.Context
import android.net.Uri
import android.provider.Telephony
import android.telephony.SmsManager
import com.desklink.data.models.SmsMessage
import com.desklink.data.models.SmsThreadSummary
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class SmsRepository(private val context: Context) {

    suspend fun getThreads(limit: Int = 50): List<SmsThreadSummary> = withContext(Dispatchers.IO) {
        val threads = linkedMapOf<String, SmsThreadSummary>()
        val cursor = context.contentResolver.query(
            Telephony.Sms.CONTENT_URI,
            arrayOf(
                Telephony.Sms._ID,
                Telephony.Sms.THREAD_ID,
                Telephony.Sms.ADDRESS,
                Telephony.Sms.BODY,
                Telephony.Sms.DATE,
                Telephony.Sms.TYPE
            ),
            null,
            null,
            "${Telephony.Sms.DATE} DESC"
        ) ?: return@withContext emptyList()

        cursor.use {
            val threadCol = it.getColumnIndex(Telephony.Sms.THREAD_ID)
            val addressCol = it.getColumnIndex(Telephony.Sms.ADDRESS)
            val bodyCol = it.getColumnIndex(Telephony.Sms.BODY)
            val dateCol = it.getColumnIndex(Telephony.Sms.DATE)

            while (it.moveToNext() && threads.size < limit) {
                val threadId = it.getLong(threadCol).toString()
                if (threads.containsKey(threadId)) continue

                val address = it.getString(addressCol) ?: "Unknown"
                val body = it.getString(bodyCol) ?: ""
                val date = it.getLong(dateCol)

                threads[threadId] = SmsThreadSummary(
                    threadId = threadId,
                    address = address,
                    displayName = address,
                    lastMessage = body,
                    lastTimestamp = date
                )
            }
        }
        threads.values.toList()
    }

    suspend fun getThreadMessages(threadId: String, limit: Int = 100): List<SmsMessage> =
        withContext(Dispatchers.IO) {
            val messages = mutableListOf<SmsMessage>()
            val cursor = context.contentResolver.query(
                Telephony.Sms.CONTENT_URI,
                arrayOf(
                    Telephony.Sms._ID,
                    Telephony.Sms.THREAD_ID,
                    Telephony.Sms.ADDRESS,
                    Telephony.Sms.BODY,
                    Telephony.Sms.DATE,
                    Telephony.Sms.TYPE
                ),
                "${Telephony.Sms.THREAD_ID} = ?",
                arrayOf(threadId),
                "${Telephony.Sms.DATE} ASC"
            ) ?: return@withContext emptyList()

            cursor.use {
                val idCol = it.getColumnIndex(Telephony.Sms._ID)
                val addressCol = it.getColumnIndex(Telephony.Sms.ADDRESS)
                val bodyCol = it.getColumnIndex(Telephony.Sms.BODY)
                val dateCol = it.getColumnIndex(Telephony.Sms.DATE)
                val typeCol = it.getColumnIndex(Telephony.Sms.TYPE)

                while (it.moveToNext()) {
                    if (messages.size >= limit) break
                    val type = it.getInt(typeCol)
                    val direction = when (type) {
                        Telephony.Sms.MESSAGE_TYPE_INBOX -> "inbound"
                        Telephony.Sms.MESSAGE_TYPE_SENT -> "outbound"
                        else -> "inbound"
                    }
                    messages.add(
                        SmsMessage(
                            id = it.getLong(idCol).toString(),
                            address = it.getString(addressCol) ?: "",
                            body = it.getString(bodyCol) ?: "",
                            direction = direction,
                            timestamp = it.getLong(dateCol),
                            status = "delivered"
                        )
                    )
                }
            }
            messages
        }

    suspend fun sendSms(address: String, body: String): Result<String> = withContext(Dispatchers.IO) {
        try {
            val smsManager = context.getSystemService(SmsManager::class.java)
                ?: SmsManager.getDefault()
            smsManager.sendTextMessage(address, null, body, null, null)
            Result.success("sent")
        } catch (e: SecurityException) {
            Result.failure(e)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
