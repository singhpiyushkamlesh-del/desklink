package com.desklink.data.repository

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.util.Base64
import android.util.Size
import com.desklink.data.models.PhotoMetadata
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.InputStream

class PhotosRepository(private val context: Context) {

    companion object {
        private const val CHUNK_SIZE = 48 * 1024
        private const val THUMB_MAX_SIZE = 256
    }

    suspend fun getRecentPhotos(limit: Int = 40): List<PhotoMetadata> = withContext(Dispatchers.IO) {
        val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        } else {
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        }

        val projection = arrayOf(
            MediaStore.Images.Media._ID,
            MediaStore.Images.Media.DISPLAY_NAME,
            MediaStore.Images.Media.MIME_TYPE,
            MediaStore.Images.Media.DATE_ADDED,
            MediaStore.Images.Media.WIDTH,
            MediaStore.Images.Media.HEIGHT
        )

        val photos = mutableListOf<PhotoMetadata>()
        val cursor = context.contentResolver.query(
            collection,
            projection,
            null,
            null,
            "${MediaStore.Images.Media.DATE_ADDED} DESC"
        ) ?: return@withContext emptyList()

        cursor.use {
            val idCol = it.getColumnIndex(MediaStore.Images.Media._ID)
            val nameCol = it.getColumnIndex(MediaStore.Images.Media.DISPLAY_NAME)
            val mimeCol = it.getColumnIndex(MediaStore.Images.Media.MIME_TYPE)
            val dateCol = it.getColumnIndex(MediaStore.Images.Media.DATE_ADDED)
            val widthCol = it.getColumnIndex(MediaStore.Images.Media.WIDTH)
            val heightCol = it.getColumnIndex(MediaStore.Images.Media.HEIGHT)

            while (it.moveToNext() && photos.size < limit) {
                val id = it.getLong(idCol).toString()
                val uri = Uri.withAppendedPath(collection, id)
                val fileName = it.getString(nameCol) ?: "photo_$id.jpg"
                val mimeType = it.getString(mimeCol) ?: "image/jpeg"
                val createdAt = it.getLong(dateCol) * 1000L
                val width = if (widthCol >= 0) it.getInt(widthCol) else null
                val height = if (heightCol >= 0) it.getInt(heightCol) else null

                photos.add(
                    PhotoMetadata(
                        id = id,
                        fileName = fileName,
                        mimeType = mimeType,
                        createdAt = createdAt,
                        width = width,
                        height = height,
                        thumbnailBase64 = loadThumbnailBase64(uri)
                    )
                )
            }
        }
        photos
    }

    suspend fun readPhotoBytes(photoId: String): ByteArray? = withContext(Dispatchers.IO) {
        val uri = contentUriForId(photoId) ?: return@withContext null
        context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
    }

    fun chunkBytes(data: ByteArray): List<ByteArray> {
        if (data.isEmpty()) return listOf(data)
        val chunks = mutableListOf<ByteArray>()
        var offset = 0
        while (offset < data.size) {
            val end = minOf(offset + CHUNK_SIZE, data.size)
            chunks.add(data.copyOfRange(offset, end))
            offset = end
        }
        return chunks
    }

    suspend fun getPhotoMeta(photoId: String): PhotoMetadata? = withContext(Dispatchers.IO) {
        val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        } else {
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        }

        val cursor = context.contentResolver.query(
            collection,
            arrayOf(
                MediaStore.Images.Media._ID,
                MediaStore.Images.Media.DISPLAY_NAME,
                MediaStore.Images.Media.MIME_TYPE,
                MediaStore.Images.Media.DATE_ADDED
            ),
            "${MediaStore.Images.Media._ID} = ?",
            arrayOf(photoId),
            null
        ) ?: return@withContext null

        cursor.use {
            if (!it.moveToFirst()) return@withContext null
            val nameCol = it.getColumnIndex(MediaStore.Images.Media.DISPLAY_NAME)
            val mimeCol = it.getColumnIndex(MediaStore.Images.Media.MIME_TYPE)
            val dateCol = it.getColumnIndex(MediaStore.Images.Media.DATE_ADDED)
            PhotoMetadata(
                id = photoId,
                fileName = it.getString(nameCol) ?: "photo_$photoId.jpg",
                mimeType = it.getString(mimeCol) ?: "image/jpeg",
                createdAt = it.getLong(dateCol) * 1000L
            )
        }
    }

    private fun contentUriForId(photoId: String): Uri? {
        val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        } else {
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        }
        return Uri.withAppendedPath(collection, photoId)
    }

    private fun loadThumbnailBase64(uri: Uri): String? {
        return try {
            val bitmap = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                context.contentResolver.loadThumbnail(uri, Size(THUMB_MAX_SIZE, THUMB_MAX_SIZE), null)
            } else {
                context.contentResolver.openInputStream(uri)?.use { stream ->
                    decodeSampledBitmap(stream)
                }
            } ?: return null

            val output = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, 70, output)
            if (!bitmap.isRecycled) bitmap.recycle()
            Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)
        } catch (_: Exception) {
            null
        }
    }

    private fun decodeSampledBitmap(stream: InputStream): Bitmap? {
        val bytes = stream.readBytes()
        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
        options.inSampleSize = calculateInSampleSize(options, THUMB_MAX_SIZE, THUMB_MAX_SIZE)
        options.inJustDecodeBounds = false
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
    }

    private fun calculateInSampleSize(
        options: BitmapFactory.Options,
        reqWidth: Int,
        reqHeight: Int
    ): Int {
        val (height, width) = options.outHeight to options.outWidth
        var inSampleSize = 1
        if (height > reqHeight || width > reqWidth) {
            var halfHeight = height / 2
            var halfWidth = width / 2
            while (halfHeight / inSampleSize >= reqHeight && halfWidth / inSampleSize >= reqWidth) {
                inSampleSize *= 2
            }
        }
        return inSampleSize
    }
}
