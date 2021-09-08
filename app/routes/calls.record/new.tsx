import * as React from 'react'
import {redirect, json, useActionData, Link} from 'remix'
import type {ActionFunction} from 'remix'
import type {KCDHandle} from '~/types'
import {CallRecorder} from '~/components/calls/recorder'
import {
  RecordingForm,
  RecordingFormData,
} from '~/components/calls/submit-recording-form'
import {requireUser} from '~/utils/session.server'
import {getReplayResponse, prisma} from '~/utils/prisma.server'
import {getErrorMessage, getNonNull} from '~/utils/misc'
import {
  getErrorForAudio,
  getErrorForTitle,
  getErrorForDescription,
  getErrorForKeywords,
} from '~/utils/call-kent'
import {useUser} from '~/utils/providers'
import {H4, Paragraph} from '~/components/typography'
import {Grimmacing} from '~/components/kifs'
import {Grid} from '~/components/grid'

export const handle: KCDHandle = {
  getSitemapEntries: () => null,
}

export const action: ActionFunction = async ({request}) => {
  const replay = getReplayResponse(request)
  if (replay) return replay

  return requireUser(request, async user => {
    const actionData: ActionData = {fields: {}, errors: {}}
    try {
      const requestText = await request.text()
      const form = new URLSearchParams(requestText)

      const formData = {
        audio: form.get('audio'),
        title: form.get('title'),
        description: form.get('description'),
        keywords: form.get('keywords'),
      }
      actionData.fields = {
        title: formData.title,
        description: formData.description,
        keywords: formData.keywords,
      }

      actionData.errors = {
        audio: getErrorForAudio(formData.audio),
        title: getErrorForTitle(formData.title),
        description: getErrorForDescription(formData.description),
        keywords: getErrorForKeywords(formData.keywords),
      }

      if (Object.values(actionData.errors).some(err => err !== null)) {
        return json(actionData, 401)
      }

      const {audio, title, description, keywords} = getNonNull(formData)

      const call = {
        title,
        description,
        keywords,
        userId: user.id,
        base64: audio,
      }
      const createdCall = await prisma.call.create({data: call})
      return redirect(`/calls/record/${createdCall.id}`)
    } catch (error: unknown) {
      actionData.errors.generalError = getErrorMessage(error)
      return json(actionData, 500)
    }
  })
}

type ActionData = RecordingFormData

export default function RecordScreen() {
  const actionData = useActionData<ActionData>()
  const [audio, setAudio] = React.useState<Blob | null>(null)
  const user = useUser()
  return (
    <div>
      {audio ? (
        <RecordingForm audio={audio} data={actionData} />
      ) : (
        <div>
          <Paragraph className="mb-4">
            {`
              Choose which recording device you would like to use.
              Then click "Start Recording," introduce yourself
              ("Hi, Kent, my name is ${user.firstName}") and say whatever you'd like.
              Try to keep it 2 minutes or less. Thanks!
            `}
          </Paragraph>
          <CallRecorder
            onRecordingComplete={recording => setAudio(recording)}
            team={user.team}
          />
        </div>
      )}
    </div>
  )
}

export function ErrorBoundary({error}: {error: Error}) {
  console.error(error)
  return (
    <div>
      <Grid nested>
        <div className="col-span-6">
          <H4 as="p">{`Yikes... Something went wrong. Sorry about that.`}</H4>
          <H4 as="p" variant="secondary" className="mt-3">
            {`Want to `}
            <Link to=".">try again?</Link>
          </H4>
        </div>
        <Grimmacing
          className="col-span-5 col-start-7 rounded-lg"
          aspectRatio="3:4"
        />
      </Grid>
    </div>
  )
}
