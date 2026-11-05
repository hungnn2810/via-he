// Short sound effects synthesized at runtime, so the game ships no audio files yet.
using System.Collections.Generic;
using UnityEngine;

namespace ViaHeOnline
{
    public static class SoundFx
    {
        const int SampleRate = 22050;
        static AudioSource _source;
        static readonly Dictionary<string, AudioClip> Clips = new Dictionary<string, AudioClip>();

        public static void Tap() => Play("tap", 0.25f, (660, 0.05f));
        public static void Error() => Play("error", 0.3f, (196, 0.12f), (165, 0.14f));
        public static void Plant() => Play("plant", 0.35f, (294, 0.07f), (392, 0.09f));
        public static void Water() => Play("water", 0.3f, (880, 0.04f), (740, 0.04f), (988, 0.05f));
        public static void Harvest() => Play("harvest", 0.4f, (523, 0.07f), (659, 0.07f), (784, 0.11f));
        public static void Sale() => Play("sale", 0.3f, (988, 0.05f), (1319, 0.1f));
        public static void LevelUp() => Play("level", 0.45f, (523, 0.09f), (659, 0.09f), (784, 0.09f), (1047, 0.2f));
        public static void Horn() => Play("horn", 0.2f, (880, 0.08f), (1175, 0.12f));

        static void Play(string name, float volume, params (float frequency, float seconds)[] notes)
        {
            if (!_source)
            {
                var go = new GameObject("SoundFx");
                Object.DontDestroyOnLoad(go);
                _source = go.AddComponent<AudioSource>();
            }
            if (!Clips.TryGetValue(name, out var clip)) Clips[name] = clip = Synthesize(name, notes);
            _source.PlayOneShot(clip, volume);
        }

        // A sine tone per note, each fading out quickly so notes sound plucked
        static AudioClip Synthesize(string name, (float frequency, float seconds)[] notes)
        {
            var samples = new List<float>();
            foreach (var (frequency, seconds) in notes)
            {
                int count = Mathf.RoundToInt(seconds * SampleRate);
                for (int i = 0; i < count; i++)
                {
                    float t = i / (float)SampleRate;
                    samples.Add(Mathf.Sin(2 * Mathf.PI * frequency * t) * (1 - i / (float)count));
                }
            }
            var clip = AudioClip.Create(name, samples.Count, 1, SampleRate, false);
            clip.SetData(samples.ToArray(), 0);
            return clip;
        }
    }
}
