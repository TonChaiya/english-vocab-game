import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

// จำนวนคำต่อด่าน
const WORDS_PER_STAGE = 100

export async function getUserProgress(userId: string) {
  const client = await clientPromise
  const db = client.db()

  // Find or create user progress
  let userProgress: any = await db.collection("progress").findOne({ userId })

  if (!userProgress) {
    userProgress = {
      userId,
      currentLevel: "a1", // Start with A1
      currentStage: 1, // Start with stage 1
      completedWords: [],
      wrongWords: [], // เพิ่มฟิลด์เก็บคำที่ตอบผิด
      playedWords: [], // เพิ่มฟิลด์เก็บคำที่เล่นแล้วทั้งหมด (ทั้งตอบถูกและผิด)
      levelProgress: {
        a1: 0,
        a2: 0,
        b1: 0,
        b2: 0,
        c1: 0,
        c2: 0,
      },
      stageProgress: {
        a1: {}, // จะเก็บข้อมูลเป็น { "1": 45, "2": 20 } (ด่าน: จำนวนคำที่เรียนแล้ว)
        a2: {},
        b1: {},
        b2: {},
        c1: {},
        c2: {},
      },
    }

    await db.collection("progress").insertOne(userProgress as any)
  }

  // ตรวจสอบว่ามี stageProgress หรือไม่ (สำหรับผู้ใช้เก่า)
  if (!userProgress.stageProgress) {
    userProgress.stageProgress = {
      a1: {},
      a2: {},
      b1: {},
      b2: {},
      c1: {},
      c2: {},
    }

    // อัพเดตข้อมูลในฐานข้อมูล
    await db.collection("progress").updateOne({ userId }, { $set: { stageProgress: userProgress.stageProgress } } as any)
  }

  // ตรวจสอบว่ามี currentStage หรือไม่ (สำหรับผู้ใช้เก่า)
  if (!userProgress.currentStage) {
    userProgress.currentStage = 1

    // อัพเดตข้อมูลในฐานข้อมูล
    await db.collection("progress").updateOne({ userId }, { $set: { currentStage: 1 } } as any)
  }

  // Ensure IDs in arrays are strings for consistent comparison
  userProgress.completedWords = (userProgress.completedWords || []).map((id: any) => String(id))
  userProgress.wrongWords = (userProgress.wrongWords || []).map((id: any) => String(id))
  userProgress.playedWords = (userProgress.playedWords || []).map((id: any) => String(id))

  return JSON.parse(JSON.stringify(userProgress))
}

export async function updateUserProgress(userId: string, wordId: string, correct: boolean, revealed = false, selectedLevel?: string, selectedStage?: number) {
  const client = await clientPromise
  const db = client.db()

  try {
    console.log(`Updating progress for user ${userId}, word ${wordId}, correct: ${correct}, revealed: ${revealed}`)

    // Get the word to determine its level
  // Support lookup by either ObjectId or string id
  const possibleId = wordId.length === 24 ? new ObjectId(wordId) : wordId
  const word = await db.collection("words").findOne({ $or: [{ _id: possibleId }, { _id: wordId }] } as any)

    if (!word) {
      console.error(`Word not found: ${wordId}`)
      throw new Error("Word not found")
    }

    console.log(`Found word: ${word.english}, level: ${word.level}`)

  // Update user progress
  const userProgress = await getUserProgress(userId)

    // Use the selected level and stage if provided, otherwise use the word's level and user's current stage
    const level = selectedLevel || word.level
    const currentStage = selectedStage || userProgress.currentStage || 1

    console.log(`Using level: ${level}, stage: ${currentStage} for progress update (word level: ${word.level})`)

    // If the selected level is different from the word's level, log a warning
    if (selectedLevel && selectedLevel !== word.level) {
      console.warn(`WARNING: Selected level (${selectedLevel}) is different from word level (${word.level}). Using selected level for progress update.`)
    }

    // Check if word is already in completedWords
    const wordAlreadyCompleted = userProgress.completedWords.includes(wordId)
    console.log(`Word already completed: ${wordAlreadyCompleted}`)

    // บันทึกคำนี้ลงในรายการคำที่เล่นแล้ว (ไม่ว่าจะตอบถูกหรือผิด)
    const wordAlreadyPlayed = userProgress.playedWords && userProgress.playedWords.includes(String(wordId))
    if (!wordAlreadyPlayed) {
      await db.collection("progress").updateOne(
        { userId },
        { $addToSet: { playedWords: String(wordId) } }
      )
      console.log(`Added word ${wordId} to playedWords`)
    }

    // ถ้าตอบผิด ให้บันทึกลงในรายการคำที่ตอบผิด
    if (!correct && !revealed) {
      const wordAlreadyWrong = userProgress.wrongWords && userProgress.wrongWords.includes(wordId)
      if (!wordAlreadyWrong) {
        await db.collection("progress").updateOne(
          { userId },
          { $addToSet: { wrongWords: wordId } }
        )
        console.log(`Added word ${wordId} to wrongWords`)
      }
    }

    // เฉพาะเมื่อตอบถูกหรือเปิดเฉลย จึงจะบันทึกลงในรายการคำที่เรียนแล้ว
    if (correct || revealed) {
      // Add word to completed words if not already there
  if (!wordAlreadyCompleted) {
        // อัพเดตจำนวนคำที่เรียนแล้วในระดับ (เฉพาะเมื่อตอบถูกเท่านั้น)
  const levelProgressUpdate = correct ? { [`levelProgress.${level}`]: 1 } : {}

        // อัพเดตจำนวนคำที่เรียนแล้วในด่าน (เฉพาะเมื่อตอบถูกเท่านั้น)
        const stageKey = `stageProgress.${level}.${currentStage}`
        const stageProgressUpdate = correct ? { [stageKey]: 1 } : {}

        console.log(`Updating progress: Adding word to completedWords and updating counters`)

        // บันทึกคำศัพท์ที่เรียน
        const updateResult = await db.collection("progress").updateOne(
          { userId },
          {
            $addToSet: { completedWords: String(wordId) },
            $inc: { ...levelProgressUpdate, ...stageProgressUpdate },
          },
        )

        // ถ้าเคยตอบผิด ให้ลบออกจากรายการคำที่ตอบผิด
        if (userProgress.wrongWords && userProgress.wrongWords.includes(String(wordId))) {
          await db.collection("progress").updateOne(
            { userId },
            // cast to any to satisfy TypeScript MongoDB operator typing
            { $pull: { wrongWords: String(wordId) } } as any
          )
          console.log(`Removed word ${wordId} from wrongWords because it's now correct`)
        }

        console.log(`Update result: matched=${updateResult.matchedCount}, modified=${updateResult.modifiedCount}`)
      } else {
        console.log(`Word ${wordId} already in completedWords, skipping update`)
      }
    }

    // ดึงข้อมูลความคืบหน้าล่าสุด
    const updatedProgress = await getUserProgress(userId)
    console.log(`Updated progress: level=${updatedProgress.currentLevel}, stage=${updatedProgress.currentStage}, completedWords=${updatedProgress.completedWords.length}`)

    // ตรวจสอบว่าควรเลื่อนไปด่านถัดไปหรือไม่
    const currentStageProgress =
      (updatedProgress.stageProgress[level] && updatedProgress.stageProgress[level][currentStage]) || 0
    console.log(`Current stage progress: ${currentStageProgress}/${WORDS_PER_STAGE}`)

    // ถ้าเรียนครบตามจำนวนคำต่อด่านแล้ว ให้เลื่อนไปด่านถัดไป
    if (currentStageProgress >= WORDS_PER_STAGE) {
      console.log(`Stage complete! Moving to next stage`)
      // Increment stage and reset that stage's counter to avoid double-count
      const stageUpdateResult = await db.collection("progress").findOneAndUpdate(
        { userId },
        {
          $inc: { currentStage: 1 },
          $set: { [`stageProgress.${level}.${currentStage}`]: WORDS_PER_STAGE }
        },
        { returnDocument: 'after' }
      )
      if (stageUpdateResult) {
        console.log(`Stage update result: ${stageUpdateResult.ok}`)
      }
    }

    // ตรวจสอบว่าควรเลื่อนไประดับถัดไปหรือไม่
    // นับจำนวนคำทั้งหมดในระดับปัจจุบัน
    const wordCountInCurrentLevel = await db.collection("words").countDocuments({ level })
    console.log(`Words in level ${level}: ${wordCountInCurrentLevel}, completed: ${updatedProgress.levelProgress[level] || 0}`)

    // ถ้าเรียนครบทุกคำในระดับแล้ว ให้เลื่อนไประดับถัดไป
  if (updatedProgress.levelProgress[level] >= wordCountInCurrentLevel) {
      const levels = ["a1", "a2", "b1", "b2", "c1", "c2"]
      const currentIndex = levels.indexOf(level)

      if (currentIndex < levels.length - 1) {
        const nextLevel = levels[currentIndex + 1]
        console.log(`Level complete! Moving from ${level} to ${nextLevel}`)
        // Set new level, reset stage to 1 and ensure stageProgress for new level exists
        const levelUpdateResult = await db.collection("progress").findOneAndUpdate(
          { userId },
          {
            $set: {
              currentLevel: nextLevel,
              currentStage: 1, // เริ่มต้นที่ด่าน 1 ของระดับใหม่
            },
            $setOnInsert: {
              // Ensure structure exists
            }
          },
          { returnDocument: 'after' }
        )

        // Initialize stageProgress for new level if missing
        const updated = (levelUpdateResult && levelUpdateResult.value) ? levelUpdateResult.value : {}
        if (!updated.stageProgress) updated.stageProgress = {}
        if (!updated.stageProgress[nextLevel]) {
          updated.stageProgress[nextLevel] = {}
          await db.collection("progress").updateOne({ userId }, { $set: { [`stageProgress.${nextLevel}`]: {} } })
        }

        console.log(`Level update applied for ${nextLevel}`)
      }
    }

    // Return serialized progress
    const finalProgress = await db.collection("progress").findOne({ userId })
    if (!finalProgress) {
      throw new Error("Failed to fetch final progress")
    }
    console.log(`Final progress: level=${finalProgress.currentLevel}, stage=${finalProgress.currentStage}, completedWords=${finalProgress.completedWords.length}`)
    return JSON.parse(JSON.stringify(finalProgress))
  } catch (error) {
    console.error("Error updating user progress:", error)
    throw error
  }
}

// ฟังก์ชันสำหรับรีเซตความคืบหน้าของระดับ
export async function resetLevelProgress(userId: string, level: string) {
  const client = await clientPromise
  const db = client.db()

  try {
    // ดึงข้อมูลความคืบหน้าปัจจุบัน
    const currentProgress = await getUserProgress(userId)

    // ดึงคำศัพท์ในระดับที่ต้องการรีเซต
    const wordsInLevel = await db.collection("words").find({ level }).toArray()
    const wordIdsInLevel = wordsInLevel.map((word) => word._id.toString())

    // ลบคำศัพท์ในระดับนี้ออกจาก completedWords
    const updatedCompletedWords = currentProgress.completedWords.filter(
      (wordId: string) => !wordIdsInLevel.includes(wordId),
    )

    // สร้าง stageProgress ใหม่สำหรับระดับนี้
    const updatedStageProgress = { ...currentProgress.stageProgress }
    updatedStageProgress[level] = {}

    // อัพเดตความคืบหน้า
    const updatedProgress = {
      ...currentProgress,
      completedWords: updatedCompletedWords,
      levelProgress: {
        ...currentProgress.levelProgress,
        [level]: 0, // รีเซตความคืบหน้าของระดับนี้เป็น 0
      },
      stageProgress: updatedStageProgress,
      currentStage: level === currentProgress.currentLevel ? 1 : currentProgress.currentStage, // รีเซตด่านเป็น 1 ถ้าเป็นระดับปัจจุบัน
    }

    await db.collection("progress").updateOne({ userId }, { $set: updatedProgress })

    return updatedProgress
  } catch (error) {
    console.error("Error resetting level progress:", error)
    throw error
  }
}

// ฟังก์ชันสำหรับรีเซตความคืบหน้าของด่าน
export async function resetStageProgress(userId: string, level: string, stage: number) {
  const client = await clientPromise
  const db = client.db()

  try {
    // ดึงข้อมูลความคืบหน้าปัจจุบัน
    const currentProgress = await getUserProgress(userId)

    // คำนวณช่วงคำศัพท์ในด่านนี้
    const startIndex = (stage - 1) * WORDS_PER_STAGE
    const endIndex = stage * WORDS_PER_STAGE

    // ดึงคำศัพท์ในระดับและด่านที่ต้องการรีเซต
    const wordsInLevel = await db
      .collection("words")
      .find({ level })
      .sort({ _id: 1 })
      .skip(startIndex)
      .limit(WORDS_PER_STAGE)
      .toArray()

    const wordIdsInStage = wordsInLevel.map((word) => word._id.toString())

    // ลบคำศัพท์ในด่านนี้ออกจาก completedWords
    const updatedCompletedWords = currentProgress.completedWords.filter(
      (wordId: string) => !wordIdsInStage.includes(wordId),
    )

    // อัพเดตความคืบหน้าของระดับ
    const levelProgressDiff = wordIdsInStage.length - (currentProgress.stageProgress[level]?.[stage] || 0)
    const updatedLevelProgress = {
      ...currentProgress.levelProgress,
      [level]: Math.max(
        0,
        (currentProgress.levelProgress[level] || 0) - (currentProgress.stageProgress[level]?.[stage] || 0),
      ),
    }

    // อัพเดตความคืบหน้าของด่าน
    const updatedStageProgress = { ...currentProgress.stageProgress }
    if (!updatedStageProgress[level]) {
      updatedStageProgress[level] = {}
    }
    updatedStageProgress[level][stage] = 0

    // อัพเดตความคืบหน้า
    const updatedProgress = {
      ...currentProgress,
      completedWords: updatedCompletedWords,
      levelProgress: updatedLevelProgress,
      stageProgress: updatedStageProgress,
    }

    await db.collection("progress").updateOne({ userId }, { $set: updatedProgress })

    return updatedProgress
  } catch (error) {
    console.error("Error resetting stage progress:", error)
    throw error
  }
}
