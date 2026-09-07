package badger

import (
	"bytes"
	"encoding/hex"
	"io"
	"testing"
	"uuid"

	"github.com/dgraph-io/badger/v4"
	"github.com/stretchr/testify/require"
)

// 기존 google/uuid의 JSON과 원본 16바이트 키를 직접 넣어 저장 형식 호환성을 검증합니다.
func TestLegacyUUIDStorage(t *testing.T) {
	db, err := New(&Config{InMemory: true, Logger: logger})
	require.NoError(t, err)
	defer db.Close()
	id := uuid.MustParse("00112233-4455-4677-8899-aabbccddeeff")
	index, err := hex.DecodeString("00112233445546778899aabbccddeeff")
	require.NoError(t, err)
	blob, err := hex.DecodeString("ffeeddccbbaa49888766554433221100")
	require.NoError(t, err)
	metadata := []byte(`{"id":"00112233-4455-4677-8899-aabbccddeeff","path":"/legacy.txt","name":"legacy.txt","size":6,"isDir":false,"internalId":"ffeeddcc-bbaa-4988-8766-554433221100"}`)
	require.NoError(t, db.db.Update(func(txn *badger.Txn) error {
		if err := txn.Set([]byte("meta:/legacy.txt"), metadata); err != nil {
			return err
		}
		if err := txn.Set(append([]byte("index:"), index...), []byte("/legacy.txt")); err != nil {
			return err
		}
		return txn.Set(append(append([]byte("blob:"), blob...), 0, 0, 0, 0), []byte("legacy"))
	}))
	read := func(want string) {
		t.Helper()
		file, err := db.Open(id)
		require.NoError(t, err)
		defer file.Close()
		data, err := io.ReadAll(file)
		require.NoError(t, err)
		require.Equal(t, want, string(data))
	}
	meta, err := db.Stat(id)
	require.NoError(t, err)
	require.Equal(t, id, meta.ID)
	read("legacy")
	_, err = db.Write(id, bytes.NewBufferString("updated"))
	require.NoError(t, err)
	read("updated")
	require.NoError(t, db.Delete(id))
}
