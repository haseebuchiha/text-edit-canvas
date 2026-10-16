import "server-only"
import mongoose, { type Types } from "mongoose"
import { readEnvironment } from "@/config/env"

export type DatabaseRecord<T> = Omit<T, "_id"> & { id: string }

export const connectToDatabase = () => mongoose.connect(readEnvironment().MONGODB_URI)

export const toRecord = <T extends { _id: Types.ObjectId }>({ _id, ...fields }: T): DatabaseRecord<T> => ({
  ...fields,
  id: _id.toString(),
})
